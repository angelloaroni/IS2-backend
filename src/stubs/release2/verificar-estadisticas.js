import assert from 'node:assert/strict';
import AppError from '../../utils/AppError.js';
import { crearFixturesRelease2 } from './fixtures.js';

/**
 * Escenario reutilizable del contrato compartido. Usar exclusivamente sobre el
 * doble o sobre una BD de prueba aislada cargada con los mismos fixtures.
 * No construye joins, ranking, filtros ni datos; contrasta respuestas del proveedor.
 * @param {import('./contratos.js').ProveedorEstadisticas} proveedor
 */
export async function verificarContratoEstadisticas(proveedor) {
    const fixture = crearFixturesRelease2();
    // El contrato de A no fija orden ni posiciones; B ordena el ranking.
    const porId = (filas) => [...filas].sort((a, b) => a.id_user - b.id_user);
    assert.deepEqual(await proveedor.obtenerEstadisticasUsuario(1), fixture.resultados.estadisticasUsuario1);
    assert.deepEqual(await proveedor.obtenerEstadisticasUsuario(5), fixture.resultados.sinActividad);
    assert.deepEqual(await proveedor.obtenerEstadisticasUsuario(1, fixture.filtros.enero), fixture.resultados.estadisticasUsuario1Enero);
    assert.deepEqual(await proveedor.obtenerEstadisticasUsuario(1, fixture.filtros.febrero), fixture.resultados.estadisticasUsuario1Febrero);
    assert.deepEqual(porId(await proveedor.listarActividadPorUsuario()), porId(fixture.resultados.actividadHistorica));
    assert.deepEqual(porId(await proveedor.listarActividadPorUsuario(fixture.filtros.enero)), porId(fixture.resultados.actividadEnero));
    assert.deepEqual(porId(await proveedor.listarActividadPorUsuario(fixture.filtros.febrero)), porId(fixture.resultados.actividadFebrero));
    assert.deepEqual(await proveedor.listarActividadPorUsuario(fixture.filtros.vacio), []);
    await assert.rejects(
        proveedor.obtenerEstadisticasUsuario(fixture.cuentaInexistente.id_user),
        (error) => error instanceof AppError
            && error.statusCode === 404
            && error.message === 'Esta cuenta no existe',
    );
}
