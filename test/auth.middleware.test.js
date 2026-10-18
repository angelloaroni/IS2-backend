import assert from 'node:assert/strict';
import test from 'node:test';
import authMiddleware from '../src/middlewares/auth.middleware.js';
import Usuario from '../src/models/Usuario.js';
import { createAccessToken } from '../src/utils/jwt.js';

test('authenticates a Bearer token against the current active user', async () => {
    const previousSecret = process.env.JWT_SECRET;
    const previousFindByPk = Usuario.findByPk;
    process.env.JWT_SECRET = 'middleware-test-secret-with-32-bytes';
    Usuario.findByPk = async (id) => ({
        id_user: id,
        cod_user: '00000042',
        nombre: 'Test User',
        tipo: 'usuario',
        estado: true,
    });

    try {
        const token = createAccessToken({ id_user: 42 });
        const req = { get: () => `Bearer ${token}` };
        const response = { status: () => response, json: (body) => body };
        let nextCalled = false;

        await authMiddleware(req, response, (error) => {
            if (error) throw error;
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.equal(req.usuario.id_user, 42);
        assert.equal(req.usuario.tipo, 'usuario');
    } finally {
        Usuario.findByPk = previousFindByPk;
        if (previousSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = previousSecret;
        }
    }
});

test('rejects requests that only provide the former user-code header', async () => {
    const req = { get: (name) => (name === 'x-cod-user' ? '00000042' : undefined) };
    let statusCode;
    let responseBody;
    const response = {
        status: (code) => {
            statusCode = code;
            return response;
        },
        json: (body) => {
            responseBody = body;
            return response;
        },
    };

    await authMiddleware(req, response, () => assert.fail('next should not be called'));

    assert.equal(statusCode, 401);
    assert.equal(responseBody.ok, false);
});
