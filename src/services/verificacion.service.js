import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Op } from 'sequelize';
import sequelize from '../config/db.js';
import VerificacionCorreo from '../models/VerificacionCorreo.js';
import UsuarioRepository from '../repositories/usuario.repository.js';
import AppError from '../utils/AppError.js';
import { enviarCodigoVerificacion } from './correo.service.js';

export const DURACION_CODIGO_MS = 3 * 60 * 1000;
export const DURACION_TOKEN_MS = 10 * 60 * 1000;
const INTERVALO_REENVIO_MS = 60 * 1000;
const MAX_INTENTOS_CODIGO = 5;
const PROPOSITOS = new Set(['registro', 'recuperacion']);
const usuarioRepository = new UsuarioRepository();

export function normalizarCorreoInstitucional(valor) {
    if (typeof valor !== 'string') {
        throw new AppError('El correo institucional es obligatorio', 400);
    }

    const correo = valor.trim().toLowerCase();
    if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        throw new AppError('El correo institucional no tiene un formato válido', 400);
    }

    return correo;
}

function validarProposito(proposito) {
    if (!PROPOSITOS.has(proposito)) {
        throw new AppError('El propósito debe ser registro o recuperacion', 400);
    }
    return proposito;
}

function obtenerSecretoVerificacion() {
    const secreto = process.env.VERIFICATION_SECRET;
    if (!secreto || Buffer.byteLength(secreto) < 32) {
        throw new AppError('VERIFICATION_SECRET debe contener al menos 32 bytes aleatorios', 500);
    }
    return secreto;
}

export function generarCodigoVerificacion() {
    return randomInt(0, 100_000_000).toString().padStart(8, '0');
}

function hashCodigo(codigo) {
    return createHmac('sha256', obtenerSecretoVerificacion()).update(codigo).digest('hex');
}

function hashToken(token) {
    return createHash('sha256').update(token).digest('hex');
}

function coincideHash(hashGuardado, hashRecibido) {
    const guardado = Buffer.from(String(hashGuardado ?? ''), 'hex');
    const recibido = Buffer.from(hashRecibido, 'hex');
    return guardado.length === recibido.length && timingSafeEqual(guardado, recibido);
}

export async function solicitarCodigoVerificacion(correoEntrada, propositoEntrada) {
    const correoInstitucional = normalizarCorreoInstitucional(correoEntrada);
    const proposito = validarProposito(propositoEntrada);
    const usuario = await usuarioRepository.buscarPorCorreo(correoInstitucional);
    const respuestaRecuperacion = {
        mensaje: 'Si el correo está asociado a una cuenta, recibirás un código de verificación.',
    };

    if (proposito === 'registro' && usuario) {
        throw new AppError('Ya existe una cuenta con ese correo institucional', 409);
    }
    if (proposito === 'recuperacion' && (!usuario || usuario.estado !== true)) {
        return respuestaRecuperacion;
    }

    const ahora = new Date();
    const fechaLimiteReenvio = new Date(ahora.getTime() - INTERVALO_REENVIO_MS);
    const codigo = generarCodigoVerificacion();
    let verificacion;

    await sequelize.transaction(async transaction => {
        const reciente = await VerificacionCorreo.findOne({
            where: {
                correo_institucional: correoInstitucional,
                proposito,
                creado_en: { [Op.gt]: fechaLimiteReenvio },
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (reciente) {
            throw new AppError('Espera un minuto antes de solicitar otro código', 429);
        }

        await VerificacionCorreo.update(
            { utilizado_en: ahora },
            {
                where: {
                    correo_institucional: correoInstitucional,
                    proposito,
                    utilizado_en: null,
                    expira_en: { [Op.gt]: ahora },
                },
                transaction,
            }
        );

        verificacion = await VerificacionCorreo.create(
            {
                correo_institucional: correoInstitucional,
                proposito,
                codigo_hash: hashCodigo(codigo),
                id_user: proposito === 'recuperacion' ? usuario.id_user : null,
                expira_en: new Date(ahora.getTime() + DURACION_CODIGO_MS),
            },
            { transaction }
        );
    });

    try {
        await enviarCodigoVerificacion(correoInstitucional, codigo, proposito);
    } catch (error) {
        await verificacion.update({ utilizado_en: new Date() });
        throw error;
    }

    return proposito === 'recuperacion'
        ? respuestaRecuperacion
        : { mensaje: 'Se envió un código de verificación al correo institucional.' };
}

export async function verificarCodigoVerificacion(data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new AppError('Los datos de verificación no son válidos', 400);
    }

    const correoInstitucional = normalizarCorreoInstitucional(data.correo_institucional);
    const proposito = validarProposito(data.proposito);
    const codigo = data.codigo_verificacion;

    if (typeof codigo !== 'string' || !/^\d{8}$/.test(codigo)) {
        throw new AppError('El código de verificación debe tener 8 dígitos', 400);
    }

    const ahora = new Date();
    let tokenSeguridad = null;
    let codigoIncorrecto = false;

    await sequelize.transaction(async transaction => {
        const verificacion = await VerificacionCorreo.findOne({
            where: {
                correo_institucional: correoInstitucional,
                proposito,
                expira_en: { [Op.gt]: ahora },
                verificado_en: null,
                utilizado_en: null,
            },
            order: [['creado_en', 'DESC']],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!verificacion || verificacion.intentos >= MAX_INTENTOS_CODIGO) {
            codigoIncorrecto = true;
            return;
        }

        if (!coincideHash(verificacion.codigo_hash, hashCodigo(codigo))) {
            const intentos = verificacion.intentos + 1;
            await verificacion.update(
                {
                    intentos,
                    ...(intentos >= MAX_INTENTOS_CODIGO ? { utilizado_en: ahora } : {}),
                },
                { transaction }
            );
            codigoIncorrecto = true;
            return;
        }

        tokenSeguridad = randomBytes(32).toString('base64url');
        await verificacion.update(
            {
                verificado_en: ahora,
                token_hash: hashToken(tokenSeguridad),
                token_expira_en: new Date(ahora.getTime() + DURACION_TOKEN_MS),
            },
            { transaction }
        );
    });

    if (codigoIncorrecto) {
        throw new AppError('El código es inválido, expiró o superó el máximo de intentos', 400);
    }

    return {
        mensaje: 'Código verificado correctamente',
        token_seguridad: tokenSeguridad,
        expira_en_segundos: DURACION_TOKEN_MS / 1000,
    };
}

export async function buscarTokenSeguridad(token, proposito, { transaction } = {}) {
    validarProposito(proposito);
    if (typeof token !== 'string' || token.length < 32) {
        throw new AppError('El token de seguridad es inválido o expiró', 401);
    }

    const verificacion = await VerificacionCorreo.findOne({
        where: {
            token_hash: hashToken(token),
            proposito,
            verificado_en: { [Op.not]: null },
            token_expira_en: { [Op.gt]: new Date() },
            utilizado_en: null,
        },
        transaction,
        lock: transaction?.LOCK.UPDATE,
    });

    if (!verificacion) {
        throw new AppError('El token de seguridad es inválido o expiró', 401);
    }

    return verificacion;
}
