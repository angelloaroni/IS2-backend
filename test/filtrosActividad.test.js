import assert from 'node:assert/strict';
import test from 'node:test';
import { validarFiltrosActividad, fechaDiaLima } from '../src/utils/filtrosActividad.js';

test('A: filtros admiten extremos opcionales y fechas reales sin mutar la entrada', () => {
    assert.deepEqual(validarFiltrosActividad(), {});
    assert.deepEqual(validarFiltrosActividad({ desde: '2024-02-29' }), { desde: '2024-02-29' });
    assert.deepEqual(validarFiltrosActividad({ hasta: '2026-02-01' }), { hasta: '2026-02-01' });
    const entrada = { desde: '2026-01-01', hasta: '2026-02-01', material: 'papel/carton' };
    assert.deepEqual(validarFiltrosActividad(entrada, { permitirMaterial: true }), entrada);
    assert.deepEqual(validarFiltrosActividad({ material: 'vidrio' }, { permitirMaterial: true }), { material: 'vidrio' });
    assert.equal(Object.keys(entrada).length, 3);
});

test('A: filtros inválidos/arrays/campos ajenos no llegan a SQL', () => {
    for (const filtros of [
        null, [], { desde: '' }, { desde: '2026-02-29' }, { hasta: '2026-02-30' },
        { desde: '0000-01-01' }, { desde: '2026-01-01T00:00:00Z' },
        { hasta: ['2026-02-01'] }, { desde: '2026-02-01', hasta: '2026-02-01' },
        { desde: '2026-03-01', hasta: '2026-02-01' }, { idUser: 2 }, { material: 'organicos' },
    ]) assert.throws(() => validarFiltrosActividad(filtros, { permitirMaterial: true }), { statusCode: 400 });
    assert.throws(() => validarFiltrosActividad({ material: 'plastico' }), { statusCode: 400 });
});

test('A: el día persistido de nuevas actividades usa Lima y no el día UTC', () => {
    assert.equal(fechaDiaLima(new Date('2026-02-01T04:59:59.999Z')), '2026-01-31');
    assert.equal(fechaDiaLima(new Date('2026-02-01T05:00:00.000Z')), '2026-02-01');
});
