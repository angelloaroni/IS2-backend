import { timingSafeEqual } from 'node:crypto';
import Usuario from '../models/Usuario.js';
import { fallo } from '../utils/respuesta.js';
import AppError from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';

export default async function authMiddleware(req, res, next) {
    const authorization = req.get('authorization');
    const match = typeof authorization === 'string'
        ? /^Bearer\s+(\S+)$/i.exec(authorization)
        : null;

    if (!match) {
        return fallo(res, 'Se requiere un token Bearer válido', 401);
    }

    let claims;
    try {
        claims = verifyAccessToken(match[1]);
    } catch (error) {
        if (error instanceof AppError) {
            return next(error);
        }
        if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
            return fallo(res, 'Token inválido o expirado', 401);
        }
        return next(error);
    }

    if (typeof claims !== 'object' || typeof claims.sub !== 'string' || !/^[1-9]\d*$/.test(claims.sub)) {
        return fallo(res, 'Token inválido o expirado', 401);
    }

    const usuario = await Usuario.findByPk(Number(claims.sub));
    if (!usuario || usuario.estado === false) {
        return fallo(res, 'Usuario no autenticado o inactivo', 401);
    }

    req.usuario = {
        id_user: usuario.id_user,
        cod_user: usuario.cod_user,
        nombre: usuario.nombre,
        tipo: usuario.tipo,
        estado: usuario.estado,
    };

    return next();
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