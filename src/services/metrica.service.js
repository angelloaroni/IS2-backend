import metricaRepository from '../repositories/metrica.repository.js';

export async function obtenerMetricas(idUser) {
    return metricaRepository.obtenerPorUsuario(idUser);
}