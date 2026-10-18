import AppError from '../utils/AppError.js';
import { TARIFAS_PUNTOS_POR_KG, calcularPuntos } from '../formulas/calcularPuntos.js';

const tiposPermitidos = new Set(Object.keys(TARIFAS_PUNTOS_POR_KG));

function normalizarTipo(tipo) {
    if (typeof tipo !== 'string') {
        throw new AppError('El tipo de residuo no es válido', 400);
    }

    const tipoNormalizado = tipo.trim().toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (!tiposPermitidos.has(tipoNormalizado)) {
        throw new AppError('El tipo de residuo no es válido', 400);
    }

    return tipoNormalizado;
}

export function validarRegistroResiduo(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new AppError('Los datos del residuo no son válidos', 400);
    }
    const { idUser, idTacho, tipo, peso, idempotencyKey } = data;
    const convertirNumero = (valor) => (
        valor === null
        || typeof valor === 'boolean'
        || (typeof valor === 'string' && valor.trim() === '')
        ? Number.NaN
        : Number(valor)
    );
    const idUserNumero = convertirNumero(idUser);
    const idTachoNumero = convertirNumero(idTacho);
    const pesoNumero = convertirNumero(peso);
    const clave = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';

    if (!Number.isInteger(idUserNumero) || idUserNumero <= 0) {
        throw new AppError('El usuario no es válido', 400);
    }
    if (!Number.isInteger(idTachoNumero) || idTachoNumero <= 0) {
        throw new AppError('El tacho no es válido', 400);
    }
    if (!Number.isFinite(pesoNumero) || pesoNumero <= 0) {
        throw new AppError('El peso debe ser mayor a cero', 400);
    }
    if (!clave || clave.length > 128) {
        throw new AppError('Se requiere una clave de idempotencia de hasta 128 caracteres', 400);
    }

    return {
        idUser: idUserNumero,
        idTacho: idTachoNumero,
        tipo: normalizarTipo(tipo),
        peso: pesoNumero,
        idempotencyKey: clave,
    };
}

export { calcularPuntos };