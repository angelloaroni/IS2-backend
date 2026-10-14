import UsuarioRepository from '../repositories/usuario.repository.js';
import AppError from '../utils/AppError.js';

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
    const cod_user = normalizarCodUser(data.cod_user);
    const nombre = String(data.nombre ?? '').trim();
    const tipo = String(data.tipo ?? '').trim().toLowerCase();
    const contraseña = String(data.contraseña ?? '').trim();

    if (!nombre) {
        throw new AppError('El nombre es obligatorio', 400);
    }

    if (!tipo) {
        throw new AppError('El tipo de usuario es obligatorio', 400);
    }

    if (!contraseña) {
        throw new AppError('La contraseña es obligatoria', 400);
    }

    const usuarioExistente = await usuarioRepository.buscarPorCodigo(cod_user);
    if (usuarioExistente) {
        throw new AppError('Ya existe un usuario con ese cod_user', 409);
    }

    const usuarioCreado = await usuarioRepository.crearUsuario({
        cod_user,
        nombre,
        puntos: 0,
        tipo,
        contraseña,
        estado: true,
    });

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

export async function validarUsuario({ cod_user, contraseña } = {}) {
    const codigo = normalizarCodUser(cod_user);

    if (contraseña === undefined || contraseña === null || String(contraseña).trim() === '') {
        throw new AppError('La contraseña es obligatoria', 400);
    }

    const usuario = await usuarioRepository.buscarPorCodigo(codigo);
    if (!usuario) {
        throw new AppError('Credenciales inválidas', 401);
    }

    const contraseñaGuardada = String(usuario['contraseña'] ?? '');
    if (contraseñaGuardada !== String(contraseña)) {
        throw new AppError('Credenciales inválidas', 401);
    }

    if (usuario.estado === false) {
        throw new AppError('El usuario está inactivo', 401);
    }

    return sanitizarUsuario(usuario);
}

export const loginUsuario = validarUsuario;