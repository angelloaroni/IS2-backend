import { exito } from '../utils/respuesta.js';
import {
    actualizarConfiguracionRanking,
    obtenerConfiguracionRanking,
    obtenerRanking,
    obtenerRecicladorMes,
} from '../services/ranking.service.js';

export async function obtenerRankingController(req, res, next) {
    try {
        const ranking = await obtenerRanking(req.usuario.id_user, req.query);
        return exito(res, ranking);
    } catch (error) {
        return next(error);
    }
}

export async function obtenerConfiguracionRankingController(req, res, next) {
    try {
        return exito(res, await obtenerConfiguracionRanking());
    } catch (error) {
        return next(error);
    }
}

export async function actualizarConfiguracionRankingController(req, res, next) {
    try {
        return exito(res, await actualizarConfiguracionRanking(req.body));
    } catch (error) {
        return next(error);
    }
}

export async function obtenerRecicladorMesController(req, res, next) {
    try {
        return exito(res, await obtenerRecicladorMes(req.query.mes));
    } catch (error) {
        return next(error);
    }
}