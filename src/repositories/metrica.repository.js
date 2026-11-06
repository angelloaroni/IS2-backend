import estadisticaRepository from './estadistica.repository.js';

class MetricaRepository {
    async obtenerPorUsuario(idUser, filtros = {}) {
        return estadisticaRepository.metricas(filtros, idUser);
    }

    async obtenerEstadisticasUsuario(idUser, filtros = {}) {
        return estadisticaRepository.estadisticasUsuario(idUser, filtros);
    }

    async listarActividadPorUsuario(filtros = {}) {
        return estadisticaRepository.listarActividad(filtros);
    }
}
export default new MetricaRepository();
