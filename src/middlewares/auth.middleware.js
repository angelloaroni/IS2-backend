import { timingSafeEqual } from 'node:crypto';
import Usuario from '../models/Usuario.js';
import { fallo } from '../utils/respuesta.js';
import AppError from '../utils/AppError.js';

export default async function authMiddleware(req, res, next) {
    try {
        const codUserHeader = req.get('x-cod-user');

        if (!codUserHeader) {
            return fallo(res, 'Falta el header x-cod-user', 401);
        }

        const codUser = String(codUserHeader).trim();

        if (!/^\d{8}$/.test(codUser)) {
            return fallo(res, 'El cod_user debe tener exactamente 8 dígitos', 401);
        }

        const usuario = await Usuario.findOne({
            where: { cod_user: codUser }
        });

        if (!usuario) {
            return fallo(res, 'Usuario no autenticado', 401);
        }

        if (usuario.estado === false) {
            return fallo(res, 'El usuario está inactivo', 401);
        }

        req.usuario = {
            id_user: usuario.id_user,
            cod_user: usuario.cod_user,
            nombre: usuario.nombre,
            tipo: usuario.tipo,
            estado: usuario.estado,
        };

        return next();
    } catch (error) {
        console.error(error);
        return fallo(res, 'Error de autenticación', 500);
    }
}

export function authTachoMiddleware(req, res, next) {
    const apiKeyConfigurada = process.env.TACHO_API_KEY;
    if (!apiKeyConfigurada) {
        return next(new AppError('La autenticación del tacho no está configurada', 500));
    }

    const apiKeyRecibida = req.get('x-tacho-api-key');
    if (typeof apiKeyRecibida !== 'string') {
        return fallo(res, 'Autenticación del tacho requerida', 401);
    }

    const claveEsperada = Buffer.from(apiKeyConfigurada);
    const claveRecibida = Buffer.from(apiKeyRecibida);
    if (
        claveEsperada.length !== claveRecibida.length
        || !timingSafeEqual(claveEsperada, claveRecibida)
    ) {
        return fallo(res, 'Clave API del tacho inválida', 401);
    }

    return next();
}

export function authorizeRoles(...rolesPermitidos) {
    const roles = rolesPermitidos.flat();

    return (req, res, next) => {
        const tipoUsuario = String(req.usuario?.tipo ?? '').toLowerCase();

        if (!roles.includes(tipoUsuario)) {
            return fallo(res, 'No tienes permisos para acceder a esta ruta', 403);
        }

        return next();
    };
}