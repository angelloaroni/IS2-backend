import { exito } from '../utils/respuesta.js';
import { registrarUsuario, validarUsuario } from '../services/usuario.service.js';
import { modificarContrasena } from '../services/recuperacion.service.js';
import {
    solicitarCodigoVerificacion,
    verificarCodigoVerificacion,
} from '../services/verificacion.service.js';

export async function solicitarCodigoRegistroController(req, res, next) {
    try {
        const resultado = await solicitarCodigoVerificacion(
            req.body?.correo_institucional,
            'registro'
        );
        return exito(res, resultado);
    } catch (error) {
        return next(error);
    }
}

export async function solicitarRecuperacionController(req, res, next) {
    try {
        const resultado = await solicitarCodigoVerificacion(
            req.body?.correo_institucional,
            'recuperacion'
        );
        return exito(res, resultado);
    } catch (error) {
        return next(error);
    }
}

export async function verificarCodigoController(req, res, next) {
    try {
        return exito(res, await verificarCodigoVerificacion(req.body));
    } catch (error) {
        return next(error);
    }
}

export async function registrarUsuarioController(req, res, next) {
    try {
        const usuario = await registrarUsuario(req.body);
        return exito(res, usuario, 201);
    } catch (error) {
        return next(error);
    }
}

export async function modificarContrasenaController(req, res, next) {
    try {
        return exito(res, await modificarContrasena(req.body));
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
