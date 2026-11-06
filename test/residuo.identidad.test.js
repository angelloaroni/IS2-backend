import assert from 'node:assert/strict';
import test from 'node:test';
import { procesarJSONTacho } from '../src/services/residuo.service.js';
import UsuarioRepository from '../src/repositories/usuario.repository.js';
import sequelize from '../src/config/db.js';

const mensaje = { idEvento: 'identidad-a4-1', codUser: '00000001', idTacho: 3, tipo: 'plastico', peso: 0.25 };

function sinEscrituras(t, usuario) {
    const buscar = UsuarioRepository.prototype.buscarPorCodigo;
    const transaction = sequelize.transaction;
    UsuarioRepository.prototype.buscarPorCodigo = async (codigo) => {
        assert.equal(codigo, mensaje.codUser);
        return usuario;
    };
    sequelize.transaction = async () => assert.fail('no debe abrir transacción para una entrada rechazada');
    t.after(() => {
        UsuarioRepository.prototype.buscarPorCodigo = buscar;
        sequelize.transaction = transaction;
    });
}

test('A4: código inexistente o cuenta inactiva se rechazan antes de cualquier escritura', async (t) => {
    sinEscrituras(t, null);
    await assert.rejects(procesarJSONTacho(mensaje), { statusCode: 404 });
    UsuarioRepository.prototype.buscarPorCodigo = async () => ({ id_user: 1, estado: false });
    await assert.rejects(procesarJSONTacho(mensaje), { statusCode: 404 });
});

test('A4: material/peso/tacho inválidos no escriben aunque la cuenta exista', async (t) => {
    sinEscrituras(t, { id_user: 1, estado: true });
    for (const cambios of [{ tipo: 'vidrio' }, { peso: 0 }, { peso: Infinity }, { idTacho: -1 }]) {
        await assert.rejects(procesarJSONTacho({ ...mensaje, ...cambios }), { statusCode: 400 });
    }
});

test('A4: el dispositivo no puede imponer puntos/fecha/usuario interno ni omitir idempotencia', async (t) => {
    sinEscrituras(t, { id_user: 1, estado: true });
    for (const cambios of [
        { puntosGanados: 1000 }, { fecha: '2000-01-01' }, { idUser: 999 },
        { idEvento: '' }, { codUser: '1' },
    ]) await assert.rejects(procesarJSONTacho({ ...mensaje, ...cambios }), { statusCode: 400 });
});
