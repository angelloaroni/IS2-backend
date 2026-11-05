import metricaRepository from '../repositories/metrica.repository.js';

export function obtenerEstadisticasUsuario(idUser, filtros = {}) {
    return metricaRepository.obtenerEstadisticasUsuario(idUser, filtros);
}

export function listarActividadPorUsuario(filtros = {}) {
    return metricaRepository.listarActividadPorUsuario(filtros);
}
