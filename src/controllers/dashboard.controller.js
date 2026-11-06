import { obtenerMateriales, obtenerParticipacion } from '../services/dashboard.service.js';
import { exito } from '../utils/respuesta.js';

export async function materiales(req, res, next) {
    try { return exito(res, await obtenerMateriales(req.query)); }
    catch (error) { return next(error); }
}
export async function participacion(req, res, next) {
    try { return exito(res, await obtenerParticipacion(req.query)); }
    catch (error) { return next(error); }
}
