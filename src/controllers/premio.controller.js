import { exito } from '../utils/respuesta.js';
import {
    agregarPremio,
    editarPremio,
    eliminarPremio,
    canjearPremio,
    obtenerPremios,
} from '../services/premio.service.js';

export async function obtenerPremiosController(req, res, next) {
    try {
        return exito(res, await obtenerPremios());
    } catch (error) {
        return next(error);
    }
}

export async function agregarPremioController(req, res, next) {
    try {
        const premio = await agregarPremio(req.body);
        return exito(res, premio, 201);
    } catch (error) {
        return next(error);
    }
}

export async function canjearPremioController(req, res, next) {
    try {
        const resultado = await canjearPremio(req.usuario.id_user, req.params.id);
        return exito(res, resultado, 200);
    } catch (error) {
        return next(error);
    }
}

export async function editarPremioController(req, res, next) {
    try {
        return exito(res, await editarPremio(req.params.id, req.body));
    } catch (error) {
        return next(error);
    }
}

export async function eliminarPremioController(req, res, next) {
    try {
        await eliminarPremio(req.params.id);
        return exito(res, { mensaje: 'Premio eliminado correctamente' });
    } catch (error) {
        return next(error);
    }
}
