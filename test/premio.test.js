import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import express from 'express';
import sequelize from '../src/config/db.js';
import Premio from '../src/models/Premio.js';
import Usuario from '../src/models/Usuario.js';
import PremioRepository from '../src/repositories/premio.repository.js';
import { agregarPremio, editarPremio, eliminarPremio, canjearPremio } from '../src/services/premio.service.js';
import routes from '../src/routes/index.routes.js';
import errorMiddleware from '../src/middlewares/error.middleware.js';
import { createAccessToken } from '../src/utils/jwt.js';

test('rechaza ids y datos inválidos antes de acceder a la base', async (t) => {
    t.mock.method(sequelize, 'transaction', () => assert.fail('no debe abrir transacción'));
    for (const id of ['0', '-1', '1.5', 'abc', '9007199254740992', '', null, true]) {
        await assert.rejects(editarPremio(id, { stock: 1 }), { statusCode: 400 });
        await assert.rejects(eliminarPremio(id), { statusCode: 400 });
    }
    for (const data of [undefined, null, [], {}, { id_premio: 1 }, { estado: false },
        { nombre: ' ' }, { descripcion: null }, { costo: 0 }, { costo: Infinity },
        { costo: true }, { costo: [] }, { costo: ' ' }, { stock: -1 },
        { stock: 1.5 }, { stock: false }, { stock: {} }]) {
        await assert.rejects(editarPremio('1', data), { statusCode: 400 });
    }
    await assert.rejects(agregarPremio({ nombre: 'Premio', costo: 10, stock: 2 }), { statusCode: 400 });
});

test('edición y eliminación usan el mismo bloqueo que el canje', async (t) => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    const datos = { id_premio: 1, nombre: 'Cuaderno', descripcion: 'Reciclado', costo: 50, stock: 20, estado: true };
    const premio = {
        ...datos,
        async update(cambios, options) {
            assert.equal(options.transaction, transaction);
            Object.assign(this, cambios);
        },
        toJSON() {
            return Object.fromEntries(Object.keys(datos).map((campo) => [campo, this[campo]]));
        },
    };
    t.mock.method(sequelize, 'transaction', async (callback) => callback(transaction));
    t.mock.method(Premio, 'findOne', async (options) => {
        assert.deepEqual(options.where, { id_premio: 1, estado: true });
        assert.equal(options.transaction, transaction);
        assert.equal(options.lock, transaction.LOCK.UPDATE);
        return premio.estado ? premio : null;
    });
    const actualizado = await editarPremio('1', { nombre: ' Nuevo cuaderno ', costo: '60', stock: 0 });
    assert.deepEqual(actualizado, { ...datos, nombre: 'Nuevo cuaderno', costo: 60, stock: 0 });
    await eliminarPremio('1');
    assert.equal(premio.estado, false);
    assert.equal(premio.descripcion, datos.descripcion);
    await assert.rejects(editarPremio('1', { stock: 2 }), { statusCode: 404 });
    await assert.rejects(eliminarPremio('1'), { statusCode: 404 });
    t.mock.method(PremioRepository.prototype, 'siguienteId', async () => 1);
    t.mock.method(PremioRepository.prototype, 'bloquearUsuario', async () => ({ estado: true }));
    t.mock.method(PremioRepository.prototype, 'crearCanje', () => assert.fail('no debe crear canje'));
    await assert.rejects(canjearPremio(1, '1'), { statusCode: 404 });
});

test('premios inexistentes devuelven 404', async (t) => {
    t.mock.method(sequelize, 'transaction', async (callback) => callback({}));
    t.mock.method(PremioRepository.prototype, 'bloquearPremio', async () => null);
    await assert.rejects(editarPremio('99', { stock: 1 }), { statusCode: 404 });
    await assert.rejects(eliminarPremio('99'), { statusCode: 404 });
});

test('el catálogo filtra activos y la consulta histórica conserva premios eliminados', async (t) => {
    const repo = new PremioRepository();
    t.mock.method(Premio, 'findAll', async (options) => {
        assert.deepEqual(options.where, { estado: true });
        return [];
    });
    await repo.listar();
    t.mock.method(Premio, 'findByPk', async (id, options) => {
        assert.equal(id, 1);
        assert.deepEqual(options, {});
        return { id_premio: 1, estado: false };
    });
    assert.equal((await repo.buscarPorId(1)).estado, false);
});

test('HTTP: edición y eliminación exigen JWT y rol admin y mantienen la respuesta estándar', async (t) => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'premios-test-secret-with-at-least-32-bytes';
    t.after(() => {
        if (previousSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousSecret;
    });
    t.mock.method(Usuario, 'findByPk', async (id) => ({ id_user: id, tipo: id === 1 ? 'admin' : 'usuario', estado: true }));
    t.mock.method(sequelize, 'transaction', async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));
    t.mock.method(PremioRepository.prototype, 'bloquearPremio', async (id) => id === 99 ? null : ({
        id_premio: id, nombre: 'Cuaderno', stock: 10,
        async update(data) { Object.assign(this, data); },
        toJSON() { return { id_premio: this.id_premio, nombre: this.nombre, stock: this.stock }; },
    }));
    const app = express();
    app.use(express.json());
    app.use('/api', routes);
    app.use(errorMiddleware);
    const server = app.listen(0, '127.0.0.1');
    t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/premios`;
    async function request(method, id, user, body) {
        const headers = { 'content-type': 'application/json' };
        if (user) headers.authorization = `Bearer ${createAccessToken({ id_user: user })}`;
        const response = await fetch(`${base}/${id}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
        return { status: response.status, body: await response.json() };
    }
    for (const method of ['PUT', 'DELETE']) {
        assert.equal((await request(method, 1, null)).status, 401);
        assert.equal((await request(method, 1, 2, { stock: 3 })).status, 403);
        assert.equal((await request(method, 99, 1, { stock: 3 })).status, 404);
        assert.equal((await request(method, 'abc', 1, { stock: 3 })).status, 400);
    }
    assert.equal((await request('PUT', 1, 1, {})).status, 400);
    assert.deepEqual(await request('PUT', 1, 1, { stock: 3 }), {
        status: 200, body: { ok: true, data: { id_premio: 1, nombre: 'Cuaderno', stock: 3 }, error: null },
    });
    assert.deepEqual(await request('DELETE', 1, 1), {
        status: 200, body: { ok: true, data: { mensaje: 'Premio eliminado correctamente' }, error: null },
    });
});
