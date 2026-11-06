import AppError from './AppError.js';

const materiales = new Set(['plastico', 'papel/carton', 'organicos']);

function fechaValida(valor) {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith('0000')) return false;
    const fecha = new Date(`${valor}T00:00:00.000Z`);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

export function validarFiltrosActividad(filtros = {}, { permitirMaterial = false } = {}) {
    if (!filtros || typeof filtros !== 'object' || Array.isArray(filtros)) {
        throw new AppError('Los filtros no son válidos', 400);
    }
    const permitidos = permitirMaterial ? ['desde', 'hasta', 'material'] : ['desde', 'hasta'];
    if (Object.keys(filtros).some((campo) => !permitidos.includes(campo))) {
        throw new AppError('Los filtros incluyen campos no permitidos', 400);
    }
    const resultado = {};
    for (const campo of ['desde', 'hasta']) {
        if (filtros[campo] !== undefined) {
            if (!fechaValida(filtros[campo])) throw new AppError(`${campo} debe ser una fecha YYYY-MM-DD válida`, 400);
            resultado[campo] = filtros[campo];
        }
    }
    if (resultado.desde && resultado.hasta && resultado.desde >= resultado.hasta) {
        throw new AppError('desde debe ser anterior a hasta (exclusivo)', 400);
    }
    if (filtros.material !== undefined) {
        if (!materiales.has(filtros.material)) throw new AppError('El material no es válido', 400);
        resultado.material = filtros.material;
    }
    return resultado;
}

export function fechaDiaLima(fecha) {
    const partes = Object.fromEntries(new Intl.DateTimeFormat('en', {
        timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(fecha).map(({ type, value }) => [type, value]));
    return `${partes.year}-${partes.month}-${partes.day}`;
}
