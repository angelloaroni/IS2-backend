import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import sequelize from '../src/config/db.js';
import VerificacionCorreo from '../src/models/VerificacionCorreo.js';
import {
    DURACION_CODIGO_MS,
    DURACION_TOKEN_MS,
    generarCodigoVerificacion,
    normalizarCorreoInstitucional,
    verificarCodigoVerificacion,
} from '../src/services/verificacion.service.js';

function mockProperty(target, name, value) {
    const hadOwnProperty = Object.hasOwn(target, name);
    const previousValue = target[name];
    target[name] = value;

    return () => {
        if (hadOwnProperty) {
            target[name] = previousValue;
        } else {
            delete target[name];
        }
    };
}

test('genera códigos de 8 dígitos y aplica las duraciones definidas', () => {
    for (let intento = 0; intento < 100; intento += 1) {
        assert.match(generarCodigoVerificacion(), /^\d{8}$/);
    }
    assert.equal(DURACION_CODIGO_MS, 180_000);
    assert.equal(DURACION_TOKEN_MS, 600_000);
});

test('normaliza y valida el correo institucional', () => {
    assert.equal(normalizarCorreoInstitucional('  Ana@Institucion.EDU  '), 'ana@institucion.edu');
    assert.throws(() => normalizarCorreoInstitucional('no-es-un-correo'), {
        message: 'El correo institucional no tiene un formato válido',
    });
});

test('verifica el código y entrega un token de seguridad con expiración de diez minutos', async () => {
    const secreto = 'test-verification-secret-with-at-least-32-bytes';
    const previousSecret = process.env.VERIFICATION_SECRET;
    process.env.VERIFICATION_SECRET = secreto;
    const ahora = Date.now();
    const verificacion = {
        codigo_hash: createHmac('sha256', secreto).update('00123456').digest('hex'),
        intentos: 0,
        update: async function update(cambios) {
            Object.assign(this, cambios);
        },
    };
    const restoreTransaction = mockProperty(sequelize, 'transaction', async callback =>
        callback({ LOCK: { UPDATE: 'UPDATE' } })
    );
    const restoreFind = mockProperty(VerificacionCorreo, 'findOne', async () => verificacion);

    try {
        const resultado = await verificarCodigoVerificacion({
            correo_institucional: 'ana@institucion.edu',
            codigo_verificacion: '00123456',
            proposito: 'registro',
        });

        assert.equal(resultado.mensaje, 'Código verificado correctamente');
        assert.equal(resultado.expira_en_segundos, 600);
        assert.equal(typeof resultado.token_seguridad, 'string');
        assert.ok(resultado.token_seguridad.length >= 32);
        assert.equal(verificacion.token_hash.length, 64);
        assert.equal(
            verificacion.token_expira_en.getTime() - verificacion.verificado_en.getTime(),
            600_000
        );
        assert.ok(verificacion.verificado_en.getTime() >= ahora);
    } finally {
        restoreFind();
        restoreTransaction();
        if (previousSecret === undefined) {
            delete process.env.VERIFICATION_SECRET;
        } else {
            process.env.VERIFICATION_SECRET = previousSecret;
        }
    }
});

test('rechaza códigos incorrectos y aumenta el contador de intentos', async () => {
    const secreto = 'test-verification-secret-with-at-least-32-bytes';
    const previousSecret = process.env.VERIFICATION_SECRET;
    process.env.VERIFICATION_SECRET = secreto;
    const verificacion = {
        codigo_hash: createHmac('sha256', secreto).update('00123456').digest('hex'),
        intentos: 0,
        update: async function update(cambios) {
            Object.assign(this, cambios);
        },
    };
    const restoreTransaction = mockProperty(sequelize, 'transaction', async callback =>
        callback({ LOCK: { UPDATE: 'UPDATE' } })
    );
    const restoreFind = mockProperty(VerificacionCorreo, 'findOne', async () => verificacion);

    try {
        await assert.rejects(
            verificarCodigoVerificacion({
                correo_institucional: 'ana@institucion.edu',
                codigo_verificacion: '87654321',
                proposito: 'registro',
            }),
            { message: 'El código es inválido, expiró o superó el máximo de intentos' }
        );
        assert.equal(verificacion.intentos, 1);
    } finally {
        restoreFind();
        restoreTransaction();
        if (previousSecret === undefined) {
            delete process.env.VERIFICATION_SECRET;
        } else {
            process.env.VERIFICATION_SECRET = previousSecret;
        }
    }
});
