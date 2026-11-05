import AppError from './AppError.js';

export function validarFechaISO(valor, campo) {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        throw new AppError(`${campo} debe tener formato YYYY-MM-DD`, 400);
    }

    const fecha = new Date(`${valor}T00:00:00.000Z`);
    if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
        throw new AppError(`${campo} no es una fecha válida`, 400);
    }
    return valor;
}

export function normalizarFiltrosPeriodo(filtros = {}) {
    if (!filtros || typeof filtros !== 'object' || Array.isArray(filtros)) {
        throw new AppError('Los filtros de período no son válidos', 400);
    }
    const camposDesconocidos = Object.keys(filtros)
        .filter((campo) => !['desde', 'hasta'].includes(campo));
    if (camposDesconocidos.length > 0) {
        throw new AppError(`Filtros no permitidos: ${camposDesconocidos.join(', ')}`, 400);
    }

    const desde = filtros.desde === undefined || filtros.desde === null || filtros.desde === ''
        ? null
        : validarFechaISO(filtros.desde, 'desde');
    const hasta = filtros.hasta === undefined || filtros.hasta === null || filtros.hasta === ''
        ? null
        : validarFechaISO(filtros.hasta, 'hasta');

    if (desde && hasta && desde >= hasta) {
        throw new AppError('hasta debe ser posterior a desde', 400);
    }

    return {
        ...(desde ? { desde } : {}),
        ...(hasta ? { hasta } : {}),
    };
}

export function obtenerRangoMes(mes) {
    if (typeof mes !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
        throw new AppError('mes debe tener formato YYYY-MM', 400);
    }

    const [anio, mesNumero] = mes.split('-').map(Number);
    const siguienteAnio = mesNumero === 12 ? anio + 1 : anio;
    const siguienteMes = mesNumero === 12 ? 1 : mesNumero + 1;
    return {
        desde: `${mes}-01`,
        hasta: `${siguienteAnio}-${String(siguienteMes).padStart(2, '0')}-01`,
    };
}

export function fechaActualLima(fecha = new Date()) {
    const partes = new Intl.DateTimeFormat('en', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(fecha);
    const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
    return `${valores.year}-${valores.month}-${valores.day}`;
}

export function mesLimaDeFecha(fecha) {
    const instante = fecha instanceof Date ? fecha : new Date(fecha);
    if (Number.isNaN(instante.getTime())) {
        throw new AppError('La fecha del evento no es válida', 400);
    }
    const partes = new Intl.DateTimeFormat('en', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
    }).formatToParts(instante);
    const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
    return `${valores.year}-${valores.month}`;
}
