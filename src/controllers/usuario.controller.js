import { exito } from '../utils/respuesta.js';
import { bloquearUsuario, obtenerUsuario } from '../services/usuario.service.js';

export async function obtenerUsuarioController(req, res, next) {
    try {
        const usuario = await obtenerUsuario(req.usuario.id_user);
        return exito(res, usuario);
    } catch (error) {
        return next(error);
    }
}

export async function bloquearUsuarioController(req, res, next) {
    try {
        const usuario = await bloquearUsuario(req.params.id);
        return exito(res, usuario);
    } catch (error) {
        return next(error);
    }
}