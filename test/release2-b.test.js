import assert from 'node:assert/strict';
import test from 'node:test';
import sequelize from '../src/config/db.js';
import configuracionRankingRepository from '../src/repositories/configuracionRanking.repository.js';
import eventoRepository from '../src/repositories/evento.repository.js';
import LogroRepository from '../src/repositories/logro.repository.js';
import RankingRepository from '../src/repositories/ranking.repository.js';
import UsuarioRepository from '../src/repositories/usuario.repository.js';
import metricaRepository from '../src/repositories/metrica.repository.js';
import ConfiguracionRanking from '../src/models/ConfiguracionRanking.js';
import RankingTop10 from '../src/models/RankingTop10.js';
import { actualizarPerfil, listarUsuariosAdmin } from '../src/services/usuario.service.js';
import {
    actualizarConfiguracionRanking,
    obtenerRanking,
    obtenerRecicladorMes,
} from '../src/services/ranking.service.js';
import { canjearPremio } from '../src/services/premio.service.js';
import { evaluarLogros } from '../src/services/logro.service.js';
import { procesarEventoNotificacion } from '../src/services/notificacion.service.js';
import { normalizarFiltrosPeriodo, obtenerRangoMes } from '../src/utils/periodo.js';

test('el listado admin pagina y no expone hashes de contraseña', async () => {
    const anterior = UsuarioRepository.prototype.listarAdministracion;
    let parametros;
    UsuarioRepository.prototype.listarAdministracion = async (input) => {
        parametros = input;
        return {
            count: 3,
            rows: [{
                id_user: 1,
                nombre: 'Ana',
                'contraseña': 'hash',
                contrasena: 'hash',
                password_hash: 'hash',
            }],
        };
    };

    try {
        const resultado = await listarUsuariosAdmin({ pagina: '2', limite: '1', q: 'Ana' });
        assert.deepEqual(parametros, { busqueda: 'Ana', limit: 1, offset: 1 });
        assert.deepEqual(resultado.pagina, { actual: 2, limite: 1, total: 3, paginas: 3 });
        assert.equal('contraseña' in resultado.usuarios[0], false);
        assert.equal('contrasena' in resultado.usuarios[0], false);
        assert.equal('password_hash' in resultado.usuarios[0], false);
        await assert.rejects(listarUsuariosAdmin({ pagina: '0' }), { statusCode: 400 });
        await assert.rejects(listarUsuariosAdmin({ limite: '101' }), { statusCode: 400 });
    } finally {
        UsuarioRepository.prototype.listarAdministracion = anterior;
    }
});

test('el perfil rechaza campos distintos del nombre', async () => {
    const anterior = UsuarioRepository.prototype.actualizarPorId;
    let actualizado;
    UsuarioRepository.prototype.actualizarPorId = async (id, cambios) => {
        actualizado = { id, cambios };
        return { id_user: id, nombre: cambios.nombre, toJSON() { return this; } };
    };

    try {
        const usuario = await actualizarPerfil(8, { nombre: '  Ana  ' });
        assert.deepEqual(actualizado, { id: 8, cambios: { nombre: 'Ana' } });
        assert.equal(usuario.nombre, 'Ana');
        await assert.rejects(
            actualizarPerfil(8, { nombre: 'Ana', puntos: 100 }),
            { statusCode: 400 }
        );
        await assert.rejects(actualizarPerfil(8, { correo_institucional: 'a@b.c' }), {
            statusCode: 400,
        });
    } finally {
        UsuarioRepository.prototype.actualizarPorId = anterior;
    }
});

test('la configuración del ranking es persistible y rechaza exclusiones inválidas', async () => {
    const anterior = RankingRepository.prototype.existenUsuariosTipoUsuario;
    RankingRepository.prototype.existenUsuariosTipoUsuario = async (ids) => ids.every((id) => id === 4);
    const anteriorGuardar = configuracionRankingRepository.guardar;
    let guardada;
    configuracionRankingRepository.guardar = async (configuracion) => {
        guardada = configuracion;
        return configuracion;
    };

    try {
        const resultado = await actualizarConfiguracionRanking({
            desde: '2026-01-01',
            hasta: '2026-02-01',
            excluidos: [4],
        });
        assert.deepEqual(resultado, {
            desde: '2026-01-01',
            hasta: '2026-02-01',
            excluidos: [4],
        });
        assert.deepEqual(guardada, resultado);
        await assert.rejects(
            actualizarConfiguracionRanking({ desde: '2026-02-01', hasta: '2026-01-01', excluidos: [] }),
            { statusCode: 400 }
        );
        await assert.rejects(
            actualizarConfiguracionRanking({ desde: null, hasta: null, excluidos: [4, 4] }),
            { statusCode: 400 }
        );
    } finally {
        RankingRepository.prototype.existenUsuariosTipoUsuario = anterior;
        configuracionRankingRepository.guardar = anteriorGuardar;
    }
});

test('el ranking ordena por puntos ganados, desempata por id y respeta exclusiones', async () => {
    const anteriorConfig = configuracionRankingRepository.obtener;
    const anteriorUsuarios = RankingRepository.prototype.listarUsuariosElegibles;
    const anteriorActividad = metricaRepository.listarActividadPorUsuario;
    configuracionRankingRepository.obtener = async () => ({
        desde: '2026-01-01',
        hasta: '2026-02-01',
        excluidos: [3],
    });
    RankingRepository.prototype.listarUsuariosElegibles = async () => [
        { id_user: 1, nombre: 'Ana' },
        { id_user: 2, nombre: 'Bea' },
        { id_user: 3, nombre: 'Cris' },
        { id_user: 4, nombre: 'Dani' },
    ];
    metricaRepository.listarActividadPorUsuario = async (filtros) => {
        assert.deepEqual(filtros, { desde: '2026-01-01', hasta: '2026-02-01' });
        return [
            { id_user: 1, puntosGanados: 10, cantidadResiduos: 2, pesoTotalKg: 1 },
            { id_user: 2, puntosGanados: 10, cantidadResiduos: 1, pesoTotalKg: 1 },
            { id_user: 3, puntosGanados: 30, cantidadResiduos: 3, pesoTotalKg: 3 },
        ];
    };

    try {
        const resultado = await obtenerRanking(2);
        assert.deepEqual(resultado.top.map(({ id_user, posicion }) => [id_user, posicion]), [
            [1, 1],
            [2, 2],
            [4, 3],
        ]);
        assert.equal(resultado.usuario.id_user, 2);
        assert.equal(resultado.total_usuarios, 3);
        assert.equal(resultado.criterio, 'puntos_ganados');
    } finally {
        configuracionRankingRepository.obtener = anteriorConfig;
        RankingRepository.prototype.listarUsuariosElegibles = anteriorUsuarios;
        metricaRepository.listarActividadPorUsuario = anteriorActividad;
    }
});

test('el reciclador del mes es null cuando no hubo actividad y valida el mes', async () => {
    const anteriorConfig = configuracionRankingRepository.obtener;
    const anteriorUsuarios = RankingRepository.prototype.listarUsuariosElegibles;
    const anteriorActividad = metricaRepository.listarActividadPorUsuario;
    configuracionRankingRepository.obtener = async () => ({
        desde: null,
        hasta: null,
        excluidos: [],
    });
    RankingRepository.prototype.listarUsuariosElegibles = async () => [
        { id_user: 1, nombre: 'Ana' },
    ];
    metricaRepository.listarActividadPorUsuario = async (filtros) => {
        assert.deepEqual(filtros, { desde: '2026-02-01', hasta: '2026-03-01' });
        return [];
    };

    try {
        assert.deepEqual(await obtenerRecicladorMes('2026-02'), {
            mes: '2026-02',
            criterio: 'puntos_ganados',
            ganador: null,
        });
        await assert.rejects(obtenerRecicladorMes('2026-13'), { statusCode: 400 });
    } finally {
        configuracionRankingRepository.obtener = anteriorConfig;
        RankingRepository.prototype.listarUsuariosElegibles = anteriorUsuarios;
        metricaRepository.listarActividadPorUsuario = anteriorActividad;
    }
});

test('un canje actualiza saldo y stock dentro de la transacción y publica idCanje', async () => {
    const anteriorTransaccion = sequelize.transaction;
    const anteriorSiguiente = (await import('../src/repositories/premio.repository.js')).default
        .prototype.siguienteId;
    const premioRepo = (await import('../src/repositories/premio.repository.js')).default;
    const anteriores = {
        usuario: premioRepo.prototype.bloquearUsuario,
        premio: premioRepo.prototype.bloquearPremio,
        crear: premioRepo.prototype.crearCanje,
    };
    const anteriorRegistrarEvento = eventoRepository.registrar;
    let eventoPublicado;
    const eventos = (await import('../src/utils/eventos.js')).default;
    const { EVENTOS } = await import('../src/utils/eventos.js');
    const listener = (payload) => { eventoPublicado = payload; };
    eventos.once(EVENTOS.PREMIO_CANJEADO, listener);

    const usuario = {
        id_user: 7,
        estado: true,
        puntos: 15,
        async decrement(campo, { by }) { this[campo] -= by; },
        async reload() {},
    };
    const premio = {
        id_premio: 2,
        nombre: 'Botella',
        costo: 5,
        stock: 1,
        async decrement(campo, { by }) { this[campo] -= by; },
        async reload() {},
    };

    sequelize.transaction = async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } });
    premioRepo.prototype.siguienteId = async () => 99;
    premioRepo.prototype.bloquearUsuario = async () => usuario;
    premioRepo.prototype.bloquearPremio = async () => premio;
    premioRepo.prototype.crearCanje = async (data) => ({ toJSON: () => data });
    eventoRepository.registrar = async () => {};

    try {
        const resultado = await canjearPremio(7, '2');
        assert.equal(resultado.puntos_restantes, 10);
        assert.equal(resultado.premio.stock, 0);
        assert.equal(resultado.canje.id_usuario_premio, 99);
        assert.equal(eventoPublicado.idCanje, 99);
    } finally {
        sequelize.transaction = anteriorTransaccion;
        premioRepo.prototype.siguienteId = anteriorSiguiente;
        premioRepo.prototype.bloquearUsuario = anteriores.usuario;
        premioRepo.prototype.bloquearPremio = anteriores.premio;
        premioRepo.prototype.crearCanje = anteriores.crear;
        eventoRepository.registrar = anteriorRegistrarEvento;
    }
});

test('los logros comparan puntos ganados y solo notifican un otorgamiento nuevo', async () => {
    const anterior = {
        listar: LogroRepository.prototype.listarTodos,
        estadisticas: LogroRepository.prototype.obtenerEstadisticasUsuario,
        ids: LogroRepository.prototype.listarIdsOtorgados,
        otorgar: LogroRepository.prototype.otorgarUnaVez,
    };
    const idsOtorgados = new Set();
    let vecesOtorgado = 0;
    const logro = {
        id_logro: 5,
        nombre: 'Acumulador',
        tipo_condicion: 'puntos_acumulados',
        valor_objetivo: 20,
        toJSON() {
            return {
                id_logro: this.id_logro,
                nombre: this.nombre,
                tipo_condicion: this.tipo_condicion,
                valor_objetivo: this.valor_objetivo,
            };
        },
    };
    LogroRepository.prototype.listarTodos = async () => [logro];
    LogroRepository.prototype.obtenerEstadisticasUsuario = async () => ({
        cantidad_residuos: 2,
        peso_total_kg: 2,
        puntos_acumulados: 20,
    });
    LogroRepository.prototype.listarIdsOtorgados = async () => new Set(idsOtorgados);
    LogroRepository.prototype.otorgarUnaVez = async (idUser, idLogro) => {
        vecesOtorgado += 1;
        if (idsOtorgados.has(idLogro)) return [{}, false];
        idsOtorgados.add(idLogro);
        return [{ id_user: idUser, id_logro: idLogro }, true];
    };

    try {
        const primero = await evaluarLogros(3);
        const segundo = await evaluarLogros(3);
        assert.equal(primero.length, 1);
        assert.deepEqual(segundo, []);
        assert.equal(vecesOtorgado, 1);
    } finally {
        LogroRepository.prototype.listarTodos = anterior.listar;
        LogroRepository.prototype.obtenerEstadisticasUsuario = anterior.estadisticas;
        LogroRepository.prototype.listarIdsOtorgados = anterior.ids;
        LogroRepository.prototype.otorgarUnaVez = anterior.otorgar;
    }
});

test('el outbox registra referencias y consumidores en la transacción del productor', async () => {
    const EventoPendiente = (await import('../src/models/EventoPendiente.js')).default;
    const EntregaEvento = (await import('../src/models/EntregaEvento.js')).default;
    const anteriorFindOrCreate = EventoPendiente.findOrCreate;
    const anteriorBulkCreate = EntregaEvento.bulkCreate;
    const transaction = {};
    let datosEvento;
    let datosEntregas;
    EventoPendiente.findOrCreate = async (options) => {
        datosEvento = options;
        return [{ id_evento: 12, tipo: options.defaults.tipo, payload: options.defaults.payload }, true];
    };
    EntregaEvento.bulkCreate = async (filas, options) => {
        datosEntregas = { filas, options };
    };

    try {
        const evento = await eventoRepository.registrar({
            tipo: 'residuo.registrado',
            referencia: 'residuo:42',
            payload: { idUser: 3, idResiduo: 42 },
        }, { transaction });
        assert.equal(evento.id_evento, 12);
        assert.equal(datosEvento.transaction, transaction);
        assert.deepEqual(datosEntregas.filas, [
            { id_evento: 12, consumidor: 'logros' },
            { id_evento: 12, consumidor: 'notificaciones' },
        ]);
        assert.equal(datosEntregas.options.transaction, transaction);
        await assert.rejects(
            eventoRepository.registrar({ tipo: 'residuo.registrado', referencia: 'residuo:43', payload: {} }),
            /requiere la transacción del productor/
        );
    } finally {
        EventoPendiente.findOrCreate = anteriorFindOrCreate;
        EntregaEvento.bulkCreate = anteriorBulkCreate;
    }
});

test('los consumidores de notificación usan referencia única y conservan destinatario y transacción', async () => {
    const Notificacion = (await import('../src/models/Notificacion.js')).default;
    const anteriorFindOrCreate = Notificacion.findOrCreate;
    const llamadas = [];
    Notificacion.findOrCreate = async (options) => {
        llamadas.push(options);
        return [{ id_notificacion: 1 }, true];
    };
    const transaction = {};

    try {
        await procesarEventoNotificacion('logro.otorgado', {
            idUser: 8,
            idLogro: 42,
            nombre: 'Reciclador',
        }, { transaction });
        await procesarEventoNotificacion('premio.canjeado', {
            idUser: 8,
            idCanje: 99,
            idPremio: 2,
            nombrePremio: 'Botella',
        }, { transaction });
        assert.equal(llamadas[0].where.referencia_evento, 'logro:8:42');
        assert.equal(llamadas[0].defaults.id_user, 8);
        assert.equal(llamadas[0].transaction, transaction);
        assert.equal(llamadas[1].where.referencia_evento, 'canje:99');
        assert.equal(llamadas[1].defaults.id_user, 8);
    } finally {
        Notificacion.findOrCreate = anteriorFindOrCreate;
    }
});

test('una entrada real al top 10 se deduplica por transición y período Lima', async () => {
    const anteriores = {
        configuracion: ConfiguracionRanking.findByPk,
        topFind: RankingTop10.findAll,
        topDestroy: RankingTop10.destroy,
        topCreate: RankingTop10.bulkCreate,
        obtenerConfig: configuracionRankingRepository.obtener,
        usuarios: RankingRepository.prototype.listarUsuariosElegibles,
        actividad: metricaRepository.listarActividadPorUsuario,
    };
    const Notificacion = (await import('../src/models/Notificacion.js')).default;
    const anteriorNotificacion = Notificacion.findOrCreate;
    const transaccion = { LOCK: { UPDATE: 'UPDATE' } };
    const notificaciones = [];
    let estadoGuardado;
    ConfiguracionRanking.findByPk = async () => ({ id_config: 1 });
    RankingTop10.findAll = async () => [{ id_user: 1 }];
    RankingTop10.destroy = async () => 1;
    RankingTop10.bulkCreate = async (filas, options) => {
        estadoGuardado = { filas, options };
    };
    configuracionRankingRepository.obtener = async () => ({
        desde: null,
        hasta: null,
        excluidos: [],
    });
    RankingRepository.prototype.listarUsuariosElegibles = async () => [
        { id_user: 1, nombre: 'Ana' },
        { id_user: 2, nombre: 'Bea' },
    ];
    metricaRepository.listarActividadPorUsuario = async (filtros) => {
        assert.deepEqual(filtros, { desde: '2026-01-01', hasta: '2026-02-01' });
        return [
            { id_user: 1, puntosGanados: 10, cantidadResiduos: 1, pesoTotalKg: 1 },
            { id_user: 2, puntosGanados: 20, cantidadResiduos: 1, pesoTotalKg: 2 },
        ];
    };
    Notificacion.findOrCreate = async (options) => {
        notificaciones.push(options);
        return [{ id_notificacion: notificaciones.length }, true];
    };

    try {
        await procesarEventoNotificacion('residuo.registrado', {
            idUser: 2,
            idResiduo: 42,
            tipo: 'plastico',
            peso: 2,
            puntosGanados: 20,
            fecha: '2026-02-01T04:59:59.999Z',
        }, { transaction: transaccion });
        assert.deepEqual(estadoGuardado.filas, [
            { periodo: '2026-01', id_user: 2 },
            { periodo: '2026-01', id_user: 1 },
        ]);
        assert.equal(estadoGuardado.options.transaction, transaccion);
        assert.equal(notificaciones[0].where.referencia_evento, 'residuo:42');
        assert.equal(notificaciones[1].where.referencia_evento, 'top10:2026-01:2:42');
        assert.equal(notificaciones[1].defaults.id_user, 2);
    } finally {
        ConfiguracionRanking.findByPk = anteriores.configuracion;
        RankingTop10.findAll = anteriores.topFind;
        RankingTop10.destroy = anteriores.topDestroy;
        RankingTop10.bulkCreate = anteriores.topCreate;
        configuracionRankingRepository.obtener = anteriores.obtenerConfig;
        RankingRepository.prototype.listarUsuariosElegibles = anteriores.usuarios;
        metricaRepository.listarActividadPorUsuario = anteriores.actividad;
        Notificacion.findOrCreate = anteriorNotificacion;
    }
});

test('los filtros de actividad son YYYY-MM-DD y usan fin exclusivo', () => {
    assert.deepEqual(normalizarFiltrosPeriodo({
        desde: '2026-01-01',
        hasta: '2026-02-01',
    }), {
        desde: '2026-01-01',
        hasta: '2026-02-01',
    });
    assert.deepEqual(obtenerRangoMes('2026-12'), {
        desde: '2026-12-01',
        hasta: '2027-01-01',
    });
    assert.throws(() => normalizarFiltrosPeriodo({ desde: '2026-02-01', hasta: '2026-01-01' }), {
        statusCode: 400,
    });
});
