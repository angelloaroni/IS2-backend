import assert from 'node:assert/strict';
import test from 'node:test';
import tachoRepository from '../src/repositories/tacho.repository.js';
import { actualizarEstadoTacho } from '../src/services/tacho.service.js';

test('actualiza los datos de estado del tacho recibidos por MQTT', async () => {
    const previousActualizar = tachoRepository.actualizar;
    let idActualizado;
    let cambiosAplicados;
    tachoRepository.actualizar = async (id, cambios) => {
        idActualizado = id;
        cambiosAplicados = cambios;
        return { id_tacho: id, ...cambios };
    };

    try {
        const estado = await actualizarEstadoTacho({
            idTacho: 7,
            latitud: -12.0464,
            longitud: -77.0428,
            capacidad: false,
        });

        assert.deepEqual(estado, {
            idTacho: 7,
            tipo: null,
            latitud: -12.0464,
            longitud: -77.0428,
            capacidad: false,
            porcentaje: null,
        });
        assert.equal(idActualizado, 7);
        assert.deepEqual(cambiosAplicados, {
            latitud: -12.0464,
            longitud: -77.0428,
            capacidad: false,
        });
    } finally {
        tachoRepository.actualizar = previousActualizar;
    }
});

test('actualiza los seis campos del nuevo JSON de estado MQTT', async () => {
    const previousActualizar = tachoRepository.actualizar;
    let cambiosAplicados;
    tachoRepository.actualizar = async (id, cambios) => {
        cambiosAplicados = cambios;
        return { id_tacho: id, ...cambios };
    };

    try {
        const estado = await actualizarEstadoTacho({
            id_tacho: 7,
            tipo: ' PLÁSTICO ',
            latitud: -12.0464,
            longitud: -77.0428,
            capacidad: true,
            porcentaje: 100,
        });

        assert.deepEqual(cambiosAplicados, {
            tipo: 'plastico',
            latitud: -12.0464,
            longitud: -77.0428,
            capacidad: true,
            porcentaje: 100,
        });
        assert.deepEqual(estado, {
            idTacho: 7,
            tipo: 'plastico',
            latitud: -12.0464,
            longitud: -77.0428,
            capacidad: true,
            porcentaje: 100,
        });
    } finally {
        tachoRepository.actualizar = previousActualizar;
    }
});

test('rechaza estados de tacho inválidos sin actualizar la base de datos', async () => {
    const previousActualizar = tachoRepository.actualizar;
    tachoRepository.actualizar = async () => assert.fail('no debe actualizar el tacho');

    try {
        await assert.rejects(
            actualizarEstadoTacho({
                idTacho: 7,
                latitud: -12.0464,
                longitud: -77.0428,
                capacidad: 'lleno',
            }),
            { statusCode: 400 }
        );
        await assert.rejects(
            actualizarEstadoTacho({
                id_tacho: 7,
                tipo: 'organicos',
                latitud: -12.0464,
                longitud: -77.0428,
                capacidad: true,
                porcentaje: 101,
            }),
            { statusCode: 400 }
        );
        await assert.rejects(
            actualizarEstadoTacho({
                idTacho: 0,
                latitud: -12.0464,
                longitud: -77.0428,
                capacidad: true,
            }),
            { statusCode: 400 }
        );
        await assert.rejects(
            actualizarEstadoTacho({
                idTacho: 7,
                latitud: -12.0464,
                longitud: -77.0428,
                capacidad: true,
                estado: false,
            }),
            { statusCode: 400 }
        );
        await assert.rejects(
            actualizarEstadoTacho({ idTacho: 7, capacidad: true }),
            { statusCode: 400 }
        );
        await assert.rejects(
            actualizarEstadoTacho({
                idTacho: 7,
                latitud: -91,
                longitud: -77.0428,
                capacidad: true,
            }),
            { statusCode: 400 }
        );
    } finally {
        tachoRepository.actualizar = previousActualizar;
    }
});
