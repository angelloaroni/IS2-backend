import estadisticaRepository from './estadistica.repository.js';

class MetricaRepository {
    async obtenerPorUsuario(idUser, filtros = {}) {
        return estadisticaRepository.metricas(filtros, idUser);
    }
}
export default new MetricaRepository();
