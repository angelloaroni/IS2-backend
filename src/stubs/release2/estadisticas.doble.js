import { isDeepStrictEqual } from 'node:util';
import AppError from '../../utils/AppError.js';
import { crearFixturesRelease2 } from './fixtures.js';

/**
 * Doble de respuestas programadas, exclusivamente para pruebas de los contratos
 * de página 8. No consulta BD, agrega actividad ni ejecuta lógica de filtros/ranking.
 * Escenario: {operacion, idUser?, filtros?, resultado} o {..., error}.
 * Para cuenta inexistente, usar el AppError 404 acordado o el doble base preparado.
 * @param {Array<Object>} escenarios
 * @returns {import('./contratos.js').ProveedorEstadisticas & {readonly llamadas: Array<Object>}}
 */
export function crearDobleEstadisticas(escenarios = []) {
    const respuestas = escenarios.map(({ error, ...escenario }) => ({
        ...structuredClone(escenario),
        ...(error === undefined ? {} : { error }),
    }));
    const llamadas = [];

    async function responder(operacion, idUser, filtros) {
        const llamada = { operacion, filtros, ...(idUser === undefined ? {} : { idUser }) };
        llamadas.push(structuredClone(llamada));
        const escenario = respuestas.find((item) => (
            item.operacion === operacion
            && item.idUser === idUser
            && isDeepStrictEqual(item.filtros ?? {}, filtros)
        ));
        if (!escenario) {
            throw new Error(`Doble R2: escenario no configurado para ${operacion}`);
        }
        if ('error' in escenario) throw escenario.error;
        if (!('resultado' in escenario)) {
            throw new Error(`Doble R2: falta resultado para ${operacion}`);
        }
        return structuredClone(escenario.resultado);
    }

    return {
        obtenerEstadisticasUsuario(idUser, filtros = {}) {
            return responder('obtenerEstadisticasUsuario', idUser, filtros);
        },
        listarActividadPorUsuario(filtros = {}) {
            return responder('listarActividadPorUsuario', undefined, filtros);
        },
        get llamadas() {
            return structuredClone(llamadas);
        },
    };
}

/**
 * Escenarios compartidos listos para A/B, sin calcular datos ni acceder a BD.
 * Cuenta 999 inexistente explícita; un ID no programado sigue fallando como error
 * de configuración del test para no ocultar escenarios que el consumidor omitió.
 */
export function crearDobleBaseRelease2() {
    const fixture = crearFixturesRelease2();
    const escenarios = [
        { operacion: 'obtenerEstadisticasUsuario', idUser: 1, resultado: fixture.resultados.estadisticasUsuario1 },
        { operacion: 'obtenerEstadisticasUsuario', idUser: 1, filtros: fixture.filtros.enero, resultado: fixture.resultados.estadisticasUsuario1Enero },
        { operacion: 'obtenerEstadisticasUsuario', idUser: 1, filtros: fixture.filtros.febrero, resultado: fixture.resultados.estadisticasUsuario1Febrero },
        { operacion: 'obtenerEstadisticasUsuario', idUser: 5, resultado: fixture.resultados.sinActividad },
        { operacion: 'obtenerEstadisticasUsuario', idUser: fixture.cuentaInexistente.id_user, error: new AppError(fixture.cuentaInexistente.mensaje, 404) },
        { operacion: 'listarActividadPorUsuario', resultado: fixture.resultados.actividadHistorica },
        { operacion: 'listarActividadPorUsuario', filtros: fixture.filtros.enero, resultado: fixture.resultados.actividadEnero },
        { operacion: 'listarActividadPorUsuario', filtros: fixture.filtros.febrero, resultado: fixture.resultados.actividadFebrero },
        { operacion: 'listarActividadPorUsuario', filtros: fixture.filtros.vacio, resultado: fixture.resultados.actividadVacia },
    ];
    return crearDobleEstadisticas(escenarios);
}
