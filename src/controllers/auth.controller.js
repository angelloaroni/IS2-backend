import { exito } from '../utils/respuesta.js';
import { registrarUsuario, validarUsuario } from '../services/usuario.service.js';

export async function registrarUsuarioController(req, res, next) {
    try {
        const usuario = await registrarUsuario(req.body);
        return exito(res, usuario, 201);
    } catch (error) {
        return next(error);
    }
}

export async function loginController(req, res, next) {
    try {
        const sesion = await validarUsuario(req.body);
        return exito(res, sesion, 200);
    } catch (error) {
        return next(error);
    }
}
