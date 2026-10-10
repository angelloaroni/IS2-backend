import Usuario from '../models/Usuario.js';
import { fallo } from '../utils/respuesta.js';

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