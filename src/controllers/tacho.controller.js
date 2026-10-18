import {
    agregarTacho as agregarTachoService,
    editarTacho as editarTachoService,
    eliminarTacho as eliminarTachoService,
    obtenerTacho as obtenerTachoService,
    obtenerTachos as obtenerTachosService,
    obtenerTachosCercanos as obtenerTachosCercanosService,
} from '../services/tacho.service.js';
import { exito } from '../utils/respuesta.js';

export async function obtenerTachos(req, res, next) {
    try {
        return exito(res, await obtenerTachosService());
    } catch (error) {
        return next(error);
    }
}

export async function obtenerTachosCercanos(req, res, next) {
    try {
        return exito(res, await obtenerTachosCercanosService(req.query));
    } catch (error) {
        return next(error);
    }
}

export async function obtenerTacho(req, res, next) {
    try {
        return exito(res, await obtenerTachoService(req.params.id));
    } catch (error) {
        return next(error);
    }
}

export async function agregarTacho(req, res, next) {
    try {
        return exito(res, await agregarTachoService(req.body), 201);
    } catch (error) {
        return next(error);
    }
}

export async function editarTacho(req, res, next) {
    try {
        return exito(res, await editarTachoService(req.params.id, req.body));
    } catch (error) {
        return next(error);
    }
}

export async function eliminarTacho(req, res, next) {
    try {
        await eliminarTachoService(req.params.id);
        return exito(res, { mensaje: 'Tacho dado de baja correctamente' });
    } catch (error) {
        return next(error);
    }
}