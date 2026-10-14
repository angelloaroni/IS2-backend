import { exito } from '../utils/respuesta.js';
import { obtenerRanking } from '../services/ranking.service.js';

export async function obtenerRankingController(req, res, next) {
    try {
        const ranking = await obtenerRanking(req.usuario.id_user);
        return exito(res, ranking);
    } catch (error) {
        return next(error);
    }
}