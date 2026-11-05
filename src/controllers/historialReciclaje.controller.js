import { obtenerHistorial } from '../services/historial.service.js';
import { obtenerMetricas } from '../services/metrica.service.js';
import { exito } from '../utils/respuesta.js';

export async function obtenerHistorialController(req, res, next) {
    try {
        return exito(res, await obtenerHistorial(req.usuario.id_user, req.query));
    } catch (error) {
        return next(error);
    }
}

export async function obtenerMetricasController(req, res, next) {
    try {
        return exito(res, await obtenerMetricas(req.usuario.id_user, req.query));
    } catch (error) {
        return next(error);
    }
}
