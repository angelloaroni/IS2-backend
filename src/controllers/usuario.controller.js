import { exito } from '../utils/respuesta.js';
import {
    actualizarPerfil,
    actualizarUsuarioAdmin,
    bloquearUsuario,
    listarUsuariosAdmin,
    obtenerUsuario,
} from '../services/usuario.service.js';

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

export async function listarUsuariosAdminController(req, res, next) {
    try {
        return exito(res, await listarUsuariosAdmin(req.query));
    } catch (error) {
        return next(error);
    }
}

export async function obtenerUsuarioAdminController(req, res, next) {
    try {
        return exito(res, await obtenerUsuario(req.params.id));
    } catch (error) {
        return next(error);
    }
}

export async function actualizarUsuarioAdminController(req, res, next) {
    try {
        return exito(res, await actualizarUsuarioAdmin(req.params.id, req.body));
    } catch (error) {
        return next(error);
    }
}

export async function actualizarPerfilController(req, res, next) {
    try {
        return exito(res, await actualizarPerfil(req.usuario.id_user, req.body));
    } catch (error) {
        return next(error);
    }
}