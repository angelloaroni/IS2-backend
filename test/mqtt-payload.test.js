import assert from 'node:assert/strict';
import test from 'node:test';
import { validarMensajeTacho } from '../src/services/residuo.service.js';
import {
    validarMensajeValidacionEstudiante,
    validarMensajeValidacionProducto,
} from '../src/services/mqtt.service.js';

test('valida el código de estudiante recibido para consulta MQTT', () => {
    assert.deepEqual(validarMensajeValidacionEstudiante({ codUser: '00001001' }), {
        codUser: '00001001',
    });
});

test('rechaza códigos de estudiante MQTT inválidos', () => {
    for (const data of [
        null,
        [],
        {},
        { codUser: 1001001 },
        { codUser: '1001001' },
        { codUser: '0000100A' },
    ]) {
        assert.throws(() => validarMensajeValidacionEstudiante(data), {
            statusCode: 400,
        });
    }
});

test('valida el código QR de producto recibido por MQTT', () => {
    assert.deepEqual(validarMensajeValidacionProducto({ codProducto: '12345678' }), {
        codProducto: '12345678',
    });
});

test('rechaza códigos QR de producto MQTT inválidos', () => {
    for (const data of [
        null,
        [],
        {},
        { codProducto: 12345678 },
        { codProducto: '1234567' },
        { codProducto: '1234567A' },
    ]) {
        assert.throws(() => validarMensajeValidacionProducto(data), {
            statusCode: 400,
        });
    }
});

test('normaliza el JSON de reciclaje recibido por MQTT', () => {
    assert.deepEqual(validarMensajeTacho({
        idtacho: 7,
        evento: 'evento-unico-0001',
        codUser: '00001001',
        tipo: 'plastico',
        peso: 0.25,
    }), {
        idEvento: 'evento-unico-0001',
        codUser: '00001001',
        idTacho: 7,
        tipo: 'plastico',
        peso: 0.25,
    });
});

test('rechaza JSON MQTT de reciclaje sin evento único o con aliases duplicados', () => {
    const payload = {
        idtacho: 7,
        evento: 'evento-unico-0001',
        codUser: '00001001',
        tipo: 'plastico',
        peso: 0.25,
    };

    assert.throws(() => validarMensajeTacho({ ...payload, evento: '' }), {
        statusCode: 400,
    });
    assert.throws(() => validarMensajeTacho({
        ...payload,
        idEvento: 'otro-evento',
    }), { statusCode: 400 });
    assert.throws(() => validarMensajeTacho({
        ...payload,
        idTacho: 7,
    }), { statusCode: 400 });
});
