import assert from 'node:assert/strict';
import test from 'node:test';
import { validarMensajeTacho } from '../src/services/residuo.service.js';
import {
    validarMensajeValidacionEstudiante,
    validarMensajeValidacionProducto,
    validarMensajeUltimoEvento,
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
        idTacho: 1,
        idEvento: 'tacho-1-evento-1',
        codUser: '00001001',
        tipo: 'plastico',
        peso: 0.25,
    }), {
        idEvento: 'tacho-1-evento-1',
        codUser: '00001001',
        idTacho: 1,
        numeroEvento: 1,
        tipo: 'plastico',
        peso: 0.25,
    });
});

test('rechaza evento inválido, tacho fuera de rango o secuencia discordante', () => {
    const payload = {
        idTacho: 1,
        idEvento: 'tacho-1-evento-1',
        codUser: '00001001',
        tipo: 'plastico',
        peso: 0.25,
    };

    for (const cambios of [
        { idEvento: '' },
        { idEvento: 'tacho-1-evento-0' },
        { idEvento: 'tacho-2-evento-1' },
        { idEvento: 'otro-evento-1' },
        { idTacho: 0 },
        { idTacho: 4 },
        { idTacho: 1.5 },
        { idTacho: '1' },
        { evento: 'tacho-1-evento-1' },
        { idtacho: 1 },
    ]) {
        assert.throws(() => validarMensajeTacho({ ...payload, ...cambios }), {
            statusCode: 400,
        });
    }
});

test('valida consultas del último evento y rechaza tachos inválidos', () => {
    assert.deepEqual(validarMensajeUltimoEvento({ idTacho: 1 }), { idTacho: 1 });
    assert.deepEqual(validarMensajeUltimoEvento({ idTacho: 2 }), { idTacho: 2 });
    assert.deepEqual(validarMensajeUltimoEvento({ idTacho: 3 }), { idTacho: 3 });

    for (const data of [
        null,
        [],
        {},
        { idTacho: 0 },
        { idTacho: 4 },
        { idTacho: '1' },
        { idTacho: 1.5 },
        { idTacho: 1, extra: true },
    ]) {
        assert.throws(() => validarMensajeUltimoEvento(data), { statusCode: 400 });
    }
});

test('rechaza JSON MQTT de reciclaje con aliases incompatibles', () => {
    const payload = {
        idTacho: 1,
        idEvento: 'tacho-1-evento-1',
        codUser: '00001001',
        tipo: 'plastico',
        peso: 0.25,
    };

    assert.throws(() => validarMensajeTacho({ ...payload, evento: '' }), {
        statusCode: 400,
    });
    assert.throws(() => validarMensajeTacho({
        ...payload,
        evento: 'tacho-1-evento-2',
    }), { statusCode: 400 });
    assert.throws(() => validarMensajeTacho({
        ...payload,
        idtacho: 1,
    }), { statusCode: 400 });
});
