import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularPuntos, validarRegistroResiduo } from '../src/services/puntos.service.js';

test('solo calcula puntos para los tres tipos permitidos', () => {
    for (const tipo of ['plastico', 'papel/carton', 'vidrio']) {
        assert.equal(calcularPuntos(0.25, tipo), 2.5);
    }
    assert.throws(() => calcularPuntos(0.25, 'organicos'), /tipo de residuo no es válido/);
});

test('acepta vidrio en el registro y rechaza materiales retirados', () => {
    const entrada = {
        idUser: 1,
        idTacho: 2,
        tipo: ' Vidrio ',
        peso: 0.25,
        idempotencyKey: 'vidrio-1',
    };
    assert.deepEqual(validarRegistroResiduo(entrada), { ...entrada, tipo: 'vidrio' });
    assert.throws(
        () => validarRegistroResiduo({ ...entrada, tipo: 'organicos' }),
        { statusCode: 400 }
    );
});
