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
import eventos, { EVENTOS } from '../utils/eventos.js';
import eventoRepository from '../repositories/evento.repository.js';

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
    const {
        contraseña,
        contrasena,
        password,
        password_hash,
        ...usuarioSinPassword
    } = usuarioJSON;
    return usuarioSinPassword;
}

function validarIdUsuario(id) {
    const idNormalizado = String(id ?? '').trim();
    if (!/^[1-9]\d*$/.test(idNormalizado) || !Number.isSafeInteger(Number(idNormalizado))) {
        throw new AppError('El id del usuario debe ser un entero positivo', 400);
    }
    return Number(idNormalizado);
}

function validarCamposPermitidos(data, permitidos) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new AppError('El cuerpo de la solicitud no es válido', 400);
    }

    const camposDesconocidos = Object.keys(data).filter((campo) => !permitidos.includes(campo));
    if (camposDesconocidos.length > 0) {
        throw new AppError(`No se permiten estos campos: ${camposDesconocidos.join(', ')}`, 400);
    }
    if (Object.keys(data).length === 0) {
        throw new AppError('Debe enviar al menos un campo permitido', 400);
    }
}

function normalizarNombre(nombre) {
    if (typeof nombre !== 'string' || !nombre.trim()) {
        throw new AppError('El nombre es obligatorio', 400);
    }
    return nombre.trim();
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
            await eventoRepository.registrar({
                tipo: 'usuario.registrado',
                referencia: `usuario:${nuevoUsuario.id_user}`,
                payload: {
                    idUser: nuevoUsuario.id_user,
                    nombre: nuevoUsuario.nombre,
                },
            }, { transaction });
            await verificacion.update({ utilizado_en: new Date() }, { transaction });
            return nuevoUsuario;
        });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            throw new AppError('Ya existe un usuario con ese código o correo institucional', 409);
        }
        throw error;
    }

    const usuarioSaneado = sanitizarUsuario(usuarioCreado);
    eventos.emit(EVENTOS.USUARIO_REGISTRADO, {
        idUser: usuarioSaneado.id_user,
        nombre: usuarioSaneado.nombre,
    });
    return usuarioSaneado;
}

export async function obtenerUsuario(id) {
    const usuario = await usuarioRepository.buscarPorId(validarIdUsuario(id));
    return sanitizarUsuario(usuario);
}

export async function bloquearUsuario(id) {
    const usuario = await usuarioRepository.desactivarPorId(validarIdUsuario(id));
    return sanitizarUsuario(usuario);
}

export async function listarUsuariosAdmin(query = {}) {
    if (!query || typeof query !== 'object' || Array.isArray(query)) {
        throw new AppError('Los parámetros de búsqueda no son válidos', 400);
    }
    const camposDesconocidos = Object.keys(query)
        .filter((campo) => !['pagina', 'limite', 'q'].includes(campo));
    if (camposDesconocidos.length > 0) {
        throw new AppError(`Parámetros no permitidos: ${camposDesconocidos.join(', ')}`, 400);
    }
    const pagina = query.pagina === undefined ? 1 : Number(query.pagina);
    const limite = query.limite === undefined ? 20 : Number(query.limite);
    if (query.q !== undefined && typeof query.q !== 'string') {
        throw new AppError('q debe ser texto', 400);
    }
    const busqueda = query.q?.trim() ?? '';

    if (!Number.isSafeInteger(pagina) || pagina < 1) {
        throw new AppError('pagina debe ser un entero positivo', 400);
    }
    if (!Number.isSafeInteger(limite) || limite < 1 || limite > 100) {
        throw new AppError('limite debe ser un entero entre 1 y 100', 400);
    }
    if (busqueda.length > 100) {
        throw new AppError('q no puede superar los 100 caracteres', 400);
    }

    const { count, rows } = await usuarioRepository.listarAdministracion({
        busqueda,
        limit: limite,
        offset: (pagina - 1) * limite,
    });

    return {
        usuarios: rows.map(sanitizarUsuario),
        pagina: {
            actual: pagina,
            limite,
            total: count,
            paginas: Math.ceil(count / limite),
        },
    };
}

export async function actualizarUsuarioAdmin(id, data = {}) {
    validarCamposPermitidos(data, ['nombre', 'estado']);
    const cambios = {};

    if (Object.hasOwn(data, 'nombre')) cambios.nombre = normalizarNombre(data.nombre);
    if (Object.hasOwn(data, 'estado')) {
        if (typeof data.estado !== 'boolean') {
            throw new AppError('estado debe ser un valor booleano', 400);
        }
        cambios.estado = data.estado;
    }

    const usuario = await usuarioRepository.actualizarPorId(validarIdUsuario(id), cambios);
    return sanitizarUsuario(usuario);
}

export async function actualizarPerfil(idUser, data = {}) {
    validarCamposPermitidos(data, ['nombre']);
    const usuario = await usuarioRepository.actualizarPorId(idUser, {
        nombre: normalizarNombre(data.nombre),
    });
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
