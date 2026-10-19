import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import sequelize from '../src/config/db.js';
import Usuario from '../src/models/Usuario.js';
import VerificacionCorreo from '../src/models/VerificacionCorreo.js';
import { modificarContrasena } from '../src/services/recuperacion.service.js';
import { verifyPassword } from '../src/utils/password.js';

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

function prepararMocks(usuario, verificacion) {
    const restoreTransaction = mockProperty(sequelize, 'transaction', async callback =>
        callback({ LOCK: { UPDATE: 'UPDATE' } })
    );
    const restoreUsuario = mockProperty(Usuario, 'findOne', async () => usuario);
    const restoreVerificacion = mockProperty(VerificacionCorreo, 'findOne', async options => {
        assert.equal(options.where.token_hash, verificacion.token_hash);
        return verificacion;
    });

    return () => {
        restoreVerificacion();
        restoreUsuario();
        restoreTransaction();
    };
}

test('cambia la contraseña solo con token de recuperación del mismo usuario', async () => {
    const token = 'test-security-token-bound-to-the-user-123456789';
    const usuario = {
        id_user: 42,
        cod_user: '00000042',
        correo_institucional: 'ana@institucion.edu',
        estado: true,
        contraseña: 'old-hash',
        update: async function update(cambios) {
            Object.assign(this, cambios);
        },
    };
    const verificacion = {
        id_user: 42,
        correo_institucional: 'ana@institucion.edu',
        token_hash: createHash('sha256').update(token).digest('hex'),
        utilizado_en: null,
        update: async function update(cambios) {
            Object.assign(this, cambios);
        },
    };
    const restore = prepararMocks(usuario, verificacion);

    try {
        const resultado = await modificarContrasena({
            cod_user: '00000042',
            nueva_contraseña: 'new test password',
            token_seguridad: token,
        });

        assert.equal(resultado.mensaje, 'La contraseña se modificó correctamente');
        assert.notEqual(usuario.contraseña, 'old-hash');
        assert.equal(await verifyPassword('new test password', usuario.contraseña), true);
        assert.ok(verificacion.utilizado_en instanceof Date);
    } finally {
        restore();
    }
});

test('rechaza un token de recuperación emitido para otro usuario', async () => {
    const token = 'test-security-token-bound-to-another-user-123456';
    const usuario = {
        id_user: 42,
        cod_user: '00000042',
        correo_institucional: 'ana@institucion.edu',
        estado: true,
        contraseña: 'old-hash',
        update: async function update(cambios) {
            Object.assign(this, cambios);
        },
    };
    const verificacion = {
        id_user: 43,
        correo_institucional: 'otra@institucion.edu',
        token_hash: createHash('sha256').update(token).digest('hex'),
        utilizado_en: null,
        update: async function update(cambios) {
            Object.assign(this, cambios);
        },
    };
    const restore = prepararMocks(usuario, verificacion);

    try {
        await assert.rejects(
            modificarContrasena({
                cod_user: '00000042',
                nueva_contraseña: 'new test password',
                token_seguridad: token,
            }),
            { message: 'El token de seguridad no corresponde al código de usuario' }
        );
        assert.equal(usuario.contraseña, 'old-hash');
        assert.equal(verificacion.utilizado_en, null);
    } finally {
        restore();
    }
});
