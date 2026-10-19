import sequelize from '../config/db.js';
import UsuarioRepository from '../repositories/usuario.repository.js';
import AppError from '../utils/AppError.js';
import { createAccessToken } from '../utils/jwt.js';
import {
    hashPassword,
    isPasswordHash,
    MAX_PASSWORD_BYTES,
    verifyPassword,
} from '../utils/password.js';
import { buscarTokenSeguridad, normalizarCorreoInstitucional } from './verificacion.service.js';

const usuarioRepository = new UsuarioRepository();

function normalizarCodUser(codUser) {
    if (codUser === undefined || codUser === null || codUser === '') {
        throw new AppError('El código de usuario es obligatorio', 400);
    }

    const valor = String(codUser).trim();
    if (!/^\d{8}$/.test(valor)) {
        throw new AppError('El cod_user debe tener exactamente 8 dígitos', 400);
    }

    return valor;
}

function sanitizarUsuario(usuario) {
    if (!usuario) return null;

    const usuarioJSON = usuario.toJSON ? usuario.toJSON() : { ...usuario };
    const { contraseña, ...usuarioSinPassword } = usuarioJSON;
    return usuarioSinPassword;
}

export async function registrarUsuario(data = {}) {
    const cod_user = normalizarCodUser(data?.cod_user);
    const nombre = String(data?.nombre ?? '').trim();
    const tipo = String(data?.tipo ?? '').trim().toLowerCase();
    const contraseña = typeof data?.contraseña === 'string' ? data.contraseña : '';
    const correo_institucional = normalizarCorreoInstitucional(data?.correo_institucional);

    if (!nombre) {
        throw new AppError('El nombre es obligatorio', 400);
    }

    if (!tipo) {
        throw new AppError('El tipo de usuario es obligatorio', 400);
    }

    if (tipo !== 'usuario') {
        throw new AppError('El registro público solo permite cuentas de usuario', 403);
    }

    if (!contraseña.trim()) {
        throw new AppError('La contraseña es obligatoria', 400);
    }

    if (Buffer.byteLength(contraseña) > MAX_PASSWORD_BYTES) {
        throw new AppError(`La contraseña no puede superar ${MAX_PASSWORD_BYTES} bytes`, 400);
    }

    let usuarioCreado;
    try {
        usuarioCreado = await sequelize.transaction(async transaction => {
            const verificacion = await buscarTokenSeguridad(data?.token_seguridad, 'registro', {
                transaction,
            });
            if (verificacion.correo_institucional !== correo_institucional) {
                throw new AppError('El token de seguridad no corresponde al correo verificado', 403);
            }

            if (await usuarioRepository.buscarPorCodigo(cod_user, { transaction })) {
                throw new AppError('Ya existe un usuario con ese cod_user', 409);
            }
            if (await usuarioRepository.buscarPorCorreo(correo_institucional, { transaction })) {
                throw new AppError('Ya existe una cuenta con ese correo institucional', 409);
            }

            const contraseñaHash = await hashPassword(contraseña);
            const nuevoUsuario = await usuarioRepository.crearUsuario(
                {
                    cod_user,
                    nombre,
                    puntos: 0,
                    tipo,
                    contraseña: contraseñaHash,
                    correo_institucional,
                    estado: true,
                },
                { transaction }
            );
            await verificacion.update({ utilizado_en: new Date() }, { transaction });
            return nuevoUsuario;
        });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            throw new AppError('Ya existe un usuario con ese código o correo institucional', 409);
        }
        throw error;
    }

    return sanitizarUsuario(usuarioCreado);
}

export async function obtenerUsuario(id) {
    const usuario = await usuarioRepository.buscarPorId(id);
    return sanitizarUsuario(usuario);
}

export async function bloquearUsuario(id) {
    const idNormalizado = String(id ?? '').trim();
    if (!/^[1-9]\d*$/.test(idNormalizado) || !Number.isSafeInteger(Number(idNormalizado))) {
        throw new AppError('El id del usuario debe ser un entero positivo', 400);
    }

    const usuario = await usuarioRepository.desactivarPorId(Number(idNormalizado));
    return sanitizarUsuario(usuario);
}

export async function validarUsuario(data = {}) {
    const codigo = normalizarCodUser(data?.cod_user);
    const contraseña = typeof data?.contraseña === 'string' ? data.contraseña : '';

    if (!contraseña.trim()) {
        throw new AppError('La contraseña es obligatoria', 400);
    }

    if (Buffer.byteLength(contraseña) > MAX_PASSWORD_BYTES) {
        throw new AppError(`La contraseña no puede superar ${MAX_PASSWORD_BYTES} bytes`, 400);
    }

    const usuario = await usuarioRepository.buscarPorCodigo(codigo);
    if (!usuario) {
        throw new AppError('Credenciales inválidas', 401);
    }

    const contraseñaGuardada = String(usuario['contraseña'] ?? '');
    if (!(await verifyPassword(contraseña, contraseñaGuardada))) {
        throw new AppError('Credenciales inválidas', 401);
    }

    if (usuario.estado === false) {
        throw new AppError('El usuario está inactivo', 401);
    }

    if (!isPasswordHash(contraseñaGuardada)) {
        await usuario.update({ contraseña: await hashPassword(contraseña) });
    }

    return {
        usuario: sanitizarUsuario(usuario),
        token: createAccessToken(usuario),
    };
}

export const loginUsuario = validarUsuario;
