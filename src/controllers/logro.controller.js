import { exito } from '../utils/respuesta.js';
import { agregarLogro, obtenerLogros } from '../services/logro.service.js';

export async function obtenerLogrosController(req, res, next) {
    try {
        const logros = await obtenerLogros(req.usuario.id_user);
        return exito(res, logros);
    } catch (error) {
        return next(error);
    }
}

export async function agregarLogroController(req, res, next) {
    try {
        const logro = await agregarLogro(req.body);
        return exito(res, logro, 201);
    } catch (error) {
        return next(error);
    }
}