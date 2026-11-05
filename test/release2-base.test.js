import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { crearFixturesRelease2 } from '../src/stubs/release2/fixtures.js';
import { crearDobleEstadisticas, crearDobleBaseRelease2 } from '../src/stubs/release2/estadisticas.doble.js';
import { verificarContratoEstadisticas } from '../src/stubs/release2/verificar-estadisticas.js';
import errorMiddleware from '../src/middlewares/error.middleware.js';
import eventos, { EVENTOS } from '../src/utils/eventos.js';
import { registrarResiduo } from '../src/services/residuo.service.js';
import sequelize from '../src/config/db.js';
import historialRepository from '../src/repositories/historial.repository.js';
import residuoRepository from '../src/repositories/residuo.repository.js';
import tachoRepository from '../src/repositories/tacho.repository.js';
import UsuarioRepository from '../src/repositories/usuario.repository.js';
import eventoPendienteRepository from '../src/repositories/eventoPendiente.repository.js';

test('el consumidor usa las dos firmas de página 8 sin proveedor real de A', async () => {
    const fixture = crearFixturesRelease2();
    const proveedor = crearDobleEstadisticas([
        { operacion: 'obtenerEstadisticasUsuario', idUser: 1, resultado: fixture.resultados.estadisticasUsuario1 },
        { operacion: 'listarActividadPorUsuario', resultado: fixture.resultados.actividadHistorica },
    ]);

    // Estas son las mismas llamadas que podrá recibir el futuro proveedor real.
    const estadisticas = await proveedor.obtenerEstadisticasUsuario(1, {});
    const actividad = await proveedor.listarActividadPorUsuario({});
    assert.deepEqual(estadisticas, { cantidad_residuos: 3, peso_total_kg: 1, puntos_acumulados: 10 });
    assert.deepEqual(actividad.find(({ id_user }) => id_user === 1), {
        id_user: 1, puntosGanados: 10, cantidadResiduos: 3, pesoTotalKg: 1,
    });
    assert.equal(fixture.usuarios[0].puntos, 5, 'el saldo del fixture no es el total ganado');
    assert.equal(actividad.some((fila) => 'posicion' in fila), false, 'el proveedor no asigna ranking');
});

test('cuenta sin actividad y lista vacía son escenarios explícitos, no errores ocultos', async () => {
    const fixture = crearFixturesRelease2();
    const proveedor = crearDobleEstadisticas([
        { operacion: 'obtenerEstadisticasUsuario', idUser: 5, resultado: fixture.resultados.sinActividad },
        { operacion: 'listarActividadPorUsuario', resultado: fixture.resultados.actividadVacia },
    ]);
    assert.deepEqual(await proveedor.obtenerEstadisticasUsuario(5), {
        cantidad_residuos: 0, peso_total_kg: 0, puntos_acumulados: 0,
    });
    assert.deepEqual(await proveedor.listarActividadPorUsuario(), []);
    await assert.rejects(proveedor.obtenerEstadisticasUsuario(999), /escenario no configurado/);
});

test('el doble propaga filtros aprobados y selecciona escenarios sin calcular consultas', async () => {
    const fixture = crearFixturesRelease2();
    const filtros = fixture.filtros.enero;
    const proveedor = crearDobleEstadisticas([
        { operacion: 'listarActividadPorUsuario', filtros, resultado: fixture.resultados.actividadEnero },
        { operacion: 'listarActividadPorUsuario', filtros: fixture.filtros.febrero, resultado: fixture.resultados.actividadFebrero },
    ]);
    assert.deepEqual(await proveedor.listarActividadPorUsuario({ ...filtros }), fixture.resultados.actividadEnero);
    assert.deepEqual(proveedor.llamadas, [{ operacion: 'listarActividadPorUsuario', filtros }]);
    assert.deepEqual(await proveedor.listarActividadPorUsuario(fixture.filtros.febrero), fixture.resultados.actividadFebrero);
    await assert.rejects(proveedor.listarActividadPorUsuario({ desde: '2026-02-02' }), /escenario no configurado/);
});

test('fallos adicionales programados se propagan y escenarios incompletos fallan explícitamente', async () => {
    const esperado = new Error('error seleccionado por este consumidor de prueba');
    const proveedor = crearDobleEstadisticas([
        { operacion: 'obtenerEstadisticasUsuario', idUser: 999, error: esperado },
    ]);
    await assert.rejects(proveedor.obtenerEstadisticasUsuario(999), (error) => error === esperado);
    const incompleto = crearDobleEstadisticas([{ operacion: 'listarActividadPorUsuario' }]);
    await assert.rejects(incompleto.listarActividadPorUsuario(), /falta resultado/);
});

test('dos consumidores y sus fixtures no comparten mutaciones ni alteran sus respuestas futuras', async () => {
    const fixture = crearFixturesRelease2();
    const otroFixture = crearFixturesRelease2();
    const escenarios = [{ operacion: 'listarActividadPorUsuario', resultado: fixture.resultados.actividadHistorica }];
    const primero = crearDobleEstadisticas(escenarios);
    const segundo = crearDobleEstadisticas(escenarios);
    escenarios[0].resultado[0].puntosGanados = -1;
    const respuesta = await primero.listarActividadPorUsuario();
    respuesta[0].puntosGanados = -2;
    primero.llamadas.length = 0;
    assert.equal((await primero.listarActividadPorUsuario())[0].puntosGanados, 10);
    assert.equal((await segundo.listarActividadPorUsuario())[0].puntosGanados, 10);
    assert.equal(primero.llamadas.length, 2);
    assert.equal(otroFixture.resultados.actividadHistorica[0].puntosGanados, 10);
    fixture.eventos.residuoRegistrado.fecha.setFullYear(2000);
    assert.equal(otroFixture.eventos.residuoRegistrado.fecha.getUTCFullYear(), 2026);
});

test('datos compartidos cubren materiales, meses, cuentas y duplicados sin confundir unidades', () => {
    const fixture = crearFixturesRelease2();
    assert.deepEqual([...new Set(fixture.residuos.map(({ tipo }) => tipo))].sort(), ['organicos', 'papel/carton', 'plastico']);
    assert.equal(new Set(fixture.historial.map(({ fecha }) => fecha.slice(0, 7))).size, 2);
    assert.ok(fixture.usuarios.some(({ estado }) => estado === false));
    assert.ok(fixture.usuarios.some(({ tipo }) => tipo === 'admin'));
    assert.equal(fixture.residuos.some(({ id_user }) => id_user === 5), false);
    const idsUnicos = new Set(fixture.historialConDuplicado.map(({ id_residuo }) => id_residuo));
    assert.equal(idsUnicos.size, fixture.residuos.length);
    assert.ok(fixture.historialConDuplicado.length > idsUnicos.size);
    // Comprueba la coherencia de las expectativas; no sustituye una consulta real.
    const kg = fixture.residuos.reduce((total, { peso }) => total + peso, 0);
    assert.equal(kg, fixture.resultados.actividadHistorica.reduce((total, fila) => total + fila.pesoTotalKg, 0));
    assert.equal(fixture.canjes[0].id_premio, fixture.premios[0].id_premio);
    assert.equal(fixture.logrosUsuario[0].id_logro, fixture.logros[0].id_logro);
});

test('los eventos de ejemplo pueden consumirse aislados sin activar listeners globales de R1', () => {
    const fixture = crearFixturesRelease2();
    const bus = new EventEmitter();
    const recibido = [];
    bus.on(EVENTOS.RESIDUO_REGISTRADO, (evento) => recibido.push(evento));
    bus.emit(EVENTOS.RESIDUO_REGISTRADO, fixture.eventos.residuoRegistrado);
    assert.deepEqual(recibido[0], {
        idUser: 1, idResiduo: 42, idTacho: 3, tipo: 'plastico', peso: 0.25,
        puntosGanados: 2.5, fecha: new Date('2026-01-15T15:00:00.000Z'),
    });
    assert.equal(fixture.eventos.logroOtorgado.idLogro, fixture.logros[0].id_logro);
    assert.equal(fixture.eventos.premioCanjeado.idPremio, fixture.premios[0].id_premio);
});

test('R1 conserva el payload publicado y lo emite solo después del commit; duplicado no emite', async (t) => {
    const fixture = crearFixturesRelease2();
    const esperado = fixture.eventos.residuoRegistrado;
    let duplicado = false;
    const pasos = [];
    const emitidos = [];
    function reemplazar(objeto, metodo, reemplazo) {
        const anterior = objeto[metodo];
        objeto[metodo] = reemplazo;
        t.after(() => { objeto[metodo] = anterior; });
    }
    reemplazar(sequelize, 'transaction', async () => ({
        LOCK: { UPDATE: 'UPDATE' },
        finished: false,
        async commit() { pasos.push('commit'); this.finished = true; },
        async rollback() { pasos.push('rollback'); this.finished = true; },
    }));
    reemplazar(residuoRepository, 'buscarPorClaveIdempotencia', async () => duplicado ? { id_residuo: 42 } : null);
    reemplazar(residuoRepository, 'crear', async (datos) => ({ ...datos, id_residuo: 42 }));
    reemplazar(historialRepository, 'crear', async () => { pasos.push('historial'); });
    reemplazar(tachoRepository, 'buscarActivoPorId', async () => fixture.tachos[0]);
    reemplazar(UsuarioRepository.prototype, 'buscarPorId', async () => fixture.usuarios[0]);
    reemplazar(UsuarioRepository.prototype, 'sumarPuntos', async () => { pasos.push('saldo'); });
    reemplazar(eventoPendienteRepository, 'registrarReciclaje', async () => { pasos.push('evento-pendiente'); });
    const listener = (payload) => {
        assert.equal(pasos.at(-1), 'commit');
        emitidos.push(payload);
    };
    eventos.on(EVENTOS.RESIDUO_REGISTRADO, listener);
    t.after(() => eventos.off(EVENTOS.RESIDUO_REGISTRADO, listener));

    const entrada = { idUser: 1, idTacho: 3, tipo: 'plastico', peso: 0.25, idempotencyKey: 'fase0-evento-42' };
    await registrarResiduo(entrada);
    assert.deepEqual(pasos, ['historial', 'saldo', 'evento-pendiente', 'commit']);
    assert.equal(emitidos.length, 1);
    assert.ok(emitidos[0].fecha instanceof Date);
    assert.deepEqual({ ...emitidos[0], fecha: esperado.fecha }, esperado);
    duplicado = true;
    await assert.rejects(registrarResiduo(entrada), (error) => error.statusCode === 409);
    assert.equal(emitidos.length, 1);
    assert.equal(pasos.at(-1), 'rollback');
});

test('el doble base pasa el escenario reutilizable que A y B podrán ejecutar con el proveedor real', async () => {
    await verificarContratoEstadisticas(crearDobleBaseRelease2());
    const sinOrdenImpuesto = crearDobleBaseRelease2();
    const listar = sinOrdenImpuesto.listarActividadPorUsuario;
    sinOrdenImpuesto.listarActividadPorUsuario = async (filtros) => (await listar(filtros)).reverse();
    await verificarContratoEstadisticas(sinOrdenImpuesto);
    // Una respuesta que rompe el contrato debe fallar: no aceptar un falso positivo.
    const incompleto = crearDobleBaseRelease2();
    incompleto.obtenerEstadisticasUsuario = async () => ({ cantidad_residuos: 0 });
    await assert.rejects(verificarContratoEstadisticas(incompleto), { name: 'AssertionError' });
});

test('la cuenta inexistente produce el 404 legible acordado usando el middleware real de R1', async () => {
    const proveedor = crearDobleBaseRelease2();
    let statusCode;
    let body;
    const res = {
        status(code) { statusCode = code; return this; },
        json(data) { body = data; return this; },
    };
    await assert.rejects(proveedor.obtenerEstadisticasUsuario(999), (error) => {
        errorMiddleware(error, {}, res, () => assert.fail('no debe continuar'));
        return true;
    });
    assert.equal(statusCode, 404);
    assert.deepEqual(body, { ok: false, data: null, mensaje: 'Esta cuenta no existe' });
});

test('los instantes de frontera compartidos corresponden al mes y día de Lima aprobados', () => {
    const fixture = crearFixturesRelease2();
    const formatter = new Intl.DateTimeFormat('en', {
        timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
    });
    for (const limite of fixture.limitesMes) {
        const parts = Object.fromEntries(formatter.formatToParts(new Date(limite.instanteUTC)).map(({ type, value }) => [type, value]));
        const dia = `${parts.year}-${parts.month}-${parts.day}`;
        assert.equal(dia, limite.diaLima);
        assert.equal(dia.slice(0, 7), limite.mesLima);
        const esEnero = dia >= fixture.filtros.enero.desde && dia < fixture.filtros.enero.hasta;
        assert.equal(esEnero, limite.mesLima === '2026-01');
    }
});

test('el fixture de participación excluye admins e inactivos y conserva usuarios sin actividad en el denominador', () => {
    const fixture = crearFixturesRelease2();
    const elegibles = fixture.usuarios.filter(({ tipo, estado }) => tipo === 'usuario' && estado);
    const activos = new Set(fixture.resultados.actividadEnero.map(({ id_user }) => id_user));
    const participantes = elegibles.filter(({ id_user }) => activos.has(id_user));
    assert.deepEqual(elegibles.map(({ id_user }) => id_user), [1, 2, 5]);
    assert.deepEqual(participantes.map(({ id_user }) => id_user), [1, 2]);
    assert.ok(activos.has(3) && activos.has(4), 'admin/inactivo tienen actividad pero no cuentan en participación');
    assert.deepEqual(fixture.resultados.participacionEnero, {
        participantes: participantes.length, denominador: elegibles.length,
        tasaPorcentaje: 100 * participantes.length / elegibles.length,
    });
    assert.deepEqual(fixture.resultados.participacionSinCuentasElegibles, {
        participantes: 0, denominador: 0, tasaPorcentaje: null,
    });
});

test('los fixtures de recuperación separan consumidores y conservan referencias entre reintentos', () => {
    const fixture = crearFixturesRelease2();
    assert.deepEqual(fixture.recuperacion.trasCaida, [
        { consumidor: 'logros', confirmado: true },
        { consumidor: 'notificaciones', confirmado: false },
    ]);
    assert.equal(fixture.recuperacion.referenciaEvento.idResiduo, fixture.eventos.residuoRegistrado.idResiduo);
    assert.deepEqual(fixture.recuperacion.reintentos[0], fixture.eventos.residuoRegistrado);
    assert.deepEqual(fixture.recuperacion.reintentos[0], fixture.recuperacion.reintentos[1]);
    assert.equal('idCanje' in fixture.eventos.premioCanjeado, false, 'R1 no cambia de payload en esta fase');
    assert.equal(fixture.eventosR2.premioCanjeado.idCanje, fixture.canjes[0].id_usuario_premio);
});

test('los avisos compartidos usan destinatarios y referencias aprobados', () => {
    const fixture = crearFixturesRelease2();
    const aviso = (efecto) => fixture.avisos.find((item) => item.efecto === efecto);
    assert.deepEqual(aviso('registro').destinatarios, fixture.usuarios.filter(({ tipo, estado }) => tipo === 'admin' && estado).map(({ id_user }) => id_user));
    assert.deepEqual(aviso('entrada-top10').destinatarios, [1]);
    assert.equal(aviso('entrada-top10').referencia.periodo, '2026-02');
    assert.ok(aviso('entrada-top10').referencia.transicion);
    for (const efecto of ['reciclaje', 'logro', 'canje']) assert.deepEqual(aviso(efecto).destinatarios, [1]);
    const usuariosActivos = fixture.usuarios.filter(({ tipo, estado }) => tipo === 'usuario' && estado).map(({ id_user }) => id_user);
    for (const efecto of ['premio-nuevo', 'novedad']) assert.deepEqual(aviso(efecto).destinatarios, usuariosActivos);
    assert.equal(aviso('canje').referencia.idCanje, fixture.eventosR2.premioCanjeado.idCanje);
});
