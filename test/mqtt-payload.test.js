import assert from 'node:assert/strict';
import test from 'node:test';
import { validarMensajeTacho } from '../src/services/residuo.service.js';

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
