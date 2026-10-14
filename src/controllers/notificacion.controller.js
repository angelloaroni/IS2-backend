import { exito } from '../utils/respuesta.js';
import {
    notificarSistema,
    obtenerNotificaciones,
} from '../services/notificacion.service.js';

export async function obtenerNotificacionesController(req, res, next) {
    try {
        const notificaciones = await obtenerNotificaciones(req.usuario.id_user);
        return exito(res, notificaciones);
    } catch (error) {
        return next(error);
    }
}

export async function notificarSistemaController(req, res, next) {
    try {
        const notificacion = await notificarSistema(req.body);
        return exito(res, notificacion, 201);
    } catch (error) {
        return next(error);
    }
}