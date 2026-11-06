import estadisticaRepository from '../repositories/estadistica.repository.js';
import { validarFiltrosActividad } from '../utils/filtrosActividad.js';

export async function obtenerMateriales(filtros = {}) {
    return estadisticaRepository.metricas(validarFiltrosActividad(filtros, { permitirMaterial: true }));
}
export async function obtenerParticipacion(filtros = {}) {
    return estadisticaRepository.participacion(validarFiltrosActividad(filtros));
}
