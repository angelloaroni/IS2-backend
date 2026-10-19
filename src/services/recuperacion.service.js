import sequelize from '../config/db.js';
import UsuarioRepository from '../repositories/usuario.repository.js';
import AppError from '../utils/AppError.js';
import { hashPassword, MAX_PASSWORD_BYTES } from '../utils/password.js';
import { buscarTokenSeguridad, normalizarCorreoInstitucional } from './verificacion.service.js';

const usuarioRepository = new UsuarioRepository();

function normalizarCodUser(codUser) {
    const codigo = typeof codUser === 'string' ? codUser.trim() : '';
    if (!/^\d{8}$/.test(codigo)) {
        throw new AppError('El cod_user debe tener exactamente 8 dígitos', 400);
    }
    return codigo;
}

function validarNuevaContrasena(contrasena) {
    if (typeof contrasena !== 'string' || !contrasena.trim()) {
        throw new AppError('La nueva contraseña es obligatoria', 400);
    }
    if (Buffer.byteLength(contrasena) > MAX_PASSWORD_BYTES) {
        throw new AppError(`La contraseña no puede superar ${MAX_PASSWORD_BYTES} bytes`, 400);
    }
}

export async function modificarContrasena(data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new AppError('Los datos para modificar la contraseña no son válidos', 400);
    }

    const codUser = normalizarCodUser(data.cod_user);
    const nuevaContrasena = data.nueva_contraseña;
    validarNuevaContrasena(nuevaContrasena);

    await sequelize.transaction(async transaction => {
        const usuario = await usuarioRepository.buscarPorCodigo(codUser, { transaction });
        if (!usuario || usuario.estado !== true) {
            throw new AppError('No existe una cuenta activa con ese código de usuario', 404);
        }

        const verificacion = await buscarTokenSeguridad(data.token_seguridad, 'recuperacion', {
            transaction,
        });
        const correoUsuario = normalizarCorreoInstitucional(usuario.correo_institucional);
        if (
            verificacion.id_user !== usuario.id_user ||
            verificacion.correo_institucional !== correoUsuario
        ) {
            throw new AppError('El token de seguridad no corresponde al código de usuario', 403);
        }

        const contraseñaHash = await hashPassword(nuevaContrasena);
        await usuario.update({ contraseña: contraseñaHash }, { transaction });
        await verificacion.update({ utilizado_en: new Date() }, { transaction });
    });

    return { mensaje: 'La contraseña se modificó correctamente' };
}
