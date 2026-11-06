import assert from 'node:assert/strict';
import test from 'node:test';
import tachoRepository from '../src/repositories/tacho.repository.js';
import { obtenerTachos, obtenerTacho, obtenerTachosCercanos } from '../src/services/tacho.service.js';

function reemplazar(t, metodo, impl) {
    const anterior = tachoRepository[metodo];
    tachoRepository[metodo] = impl;
    t.after(() => { tachoRepository[metodo] = anterior; });
}

function tacho(id, latitud = -12.0464, longitud = -77.0428) {
    return { id_tacho: id, tipo: 'plastico', latitud, longitud, capacidad: false, porcentaje: 25, estado: true };
}

test('A5: listado/detalle conservan campos públicos y no exponen estado administrativo', async (t) => {
    reemplazar(t, 'listarActivos', async () => [tacho(1)]);
    reemplazar(t, 'buscarActivoPorId', async (id) => {
        assert.equal(id, 1);
        return tacho(id);
    });
    const esperado = { idTacho: 1, tipo: 'plastico', latitud: -12.0464, longitud: -77.0428, capacidad: false, porcentaje: 25 };
    assert.deepEqual(await obtenerTachos(), [esperado]);
    assert.deepEqual(await obtenerTacho('1'), esperado);
});

test('A5: listado y cercanía sin coincidencias devuelven listas vacías', async (t) => {
    reemplazar(t, 'listarActivos', async () => []);
    reemplazar(t, 'buscarActivosEnRectangulo', async () => []);
    assert.deepEqual(await obtenerTachos(), []);
    assert.deepEqual(await obtenerTachosCercanos({ lat: '-12', lng: '-77' }), []);
});

test('A5: cercanía ordena distancia, excluye fuera del círculo y conserva distanciaM', async (t) => {
    reemplazar(t, 'buscarActivosEnRectangulo', async () => [
        tacho(2, -12.0464, -77.05), tacho(3, -12.0464, -78), tacho(1),
    ]);
    const filas = await obtenerTachosCercanos({ lat: '-12.0464', lng: '-77.0428', radio: '1000' });
    assert.deepEqual(filas.map(({ idTacho }) => idTacho), [1, 2]);
    assert.equal(filas[0].distanciaM, 0);
    assert.ok(filas[1].distanciaM > 0 && filas[1].distanciaM <= 1000);
    assert.equal('distanciaExacta' in filas[0], false);
});

test('A5: coordenadas/radios inválidos e IDs inválidos no consultan repositorio', async (t) => {
    reemplazar(t, 'buscarActivosEnRectangulo', async () => assert.fail('consulta inesperada'));
    reemplazar(t, 'buscarActivoPorId', async () => assert.fail('consulta inesperada'));
    for (const campos of [
        {}, { lat: '', lng: 0 }, { lat: 91, lng: 0 }, { lat: 0, lng: -181 },
        { lat: 0, lng: 0, radio: 0 }, { lat: 0, lng: 0, radio: 50001 },
        { lat: 0, lng: 0, radio: 'NaN' },
    ]) await assert.rejects(obtenerTachosCercanos(campos), (error) => error.statusCode === 400);
    for (const id of [0, -1, 'texto', 1.5]) {
        await assert.rejects(obtenerTacho(id), (error) => error.statusCode === 400);
    }
});

test('A5: conserva radio por defecto y admite máximo/antimeridiano', async (t) => {
    const cajas = [];
    reemplazar(t, 'buscarActivosEnRectangulo', async (caja) => { cajas.push(caja); return []; });
    await obtenerTachosCercanos({ lat: 0, lng: 0 });
    const delta = 5000 / 6371000 * 180 / Math.PI;
    assert.ok(Math.abs(cajas[0].latitudMaxima - delta) < 1e-10);
    await obtenerTachosCercanos({ lat: 0, lng: 179.99, radio: 50000 });
    assert.equal(cajas[1].longitud.cruzaAntimeridiano, true);
});
