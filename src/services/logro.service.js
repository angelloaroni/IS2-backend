import AppError from '../utils/AppError.js';
import LogroRepository from '../repositories/logro.repository.js';
import { fechaActualLima } from '../utils/periodo.js';

const logroRepository = new LogroRepository();
const TIPOS_CONDICION = new Set([
    'cantidad_residuos',
    'puntos_acumulados',
    'peso_total_kg',
]);

export async function obtenerLogros(idUser) {
    const otorgados = await logroRepository.listarOtorgadosAUsuario(idUser);
    if (otorgados.length === 0) return [];

    const logros = await logroRepository.buscarVariosPorId(
        otorgados.map(({ id_logro }) => id_logro)
    );
    const logrosPorId = new Map(logros.map((logro) => [Number(logro.id_logro), logro]));

    return otorgados.flatMap((otorgado) => {
        const logro = logrosPorId.get(Number(otorgado.id_logro));
        return logro
            ? [{ ...logro.toJSON(), fecha_obtencion: otorgado.fecha_obtencion }]
            : [];
    });
}

export async function agregarLogro(data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new AppError('Los datos del logro no son válidos', 400);
    }
    const camposDesconocidos = Object.keys(data)
        .filter((campo) => !['id_logro', 'nombre', 'tipo_condicion', 'valor_objetivo'].includes(campo));
    if (camposDesconocidos.length > 0) {
        throw new AppError(`Campos no permitidos: ${camposDesconocidos.join(', ')}`, 400);
    }
    const id = Number(data.id_logro);
    const nombre = typeof data.nombre === 'string' ? data.nombre.trim() : '';
    const tipoCondicion = typeof data.tipo_condicion === 'string'
        ? data.tipo_condicion.trim().toLowerCase()
        : '';
    const valorObjetivo = typeof data.valor_objetivo === 'boolean'
        || data.valor_objetivo === null
        || data.valor_objetivo === ''
        ? Number.NaN
        : Number(data.valor_objetivo);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new AppError('id_logro debe ser un entero positivo', 400);
    }
    if (!nombre) {
        throw new AppError('El nombre del logro es obligatorio', 400);
    }
    if (!TIPOS_CONDICION.has(tipoCondicion)) {
        throw new AppError('El tipo_condicion no es válido', 400);
    }
    if (!Number.isFinite(valorObjetivo) || valorObjetivo <= 0) {
        throw new AppError('valor_objetivo debe ser mayor a cero', 400);
    }

    const existente = await logroRepository.buscarPorId(id);
    if (existente) {
        throw new AppError('Ya existe un logro con ese id_logro', 409);
    }

    const logro = await logroRepository.crear({
        id_logro: id,
        nombre,
        tipo_condicion: tipoCondicion,
        valor_objetivo: valorObjetivo,
    });

    return logro.toJSON();
}

export async function evaluarLogros(idUser, { transaction = null } = {}) {
    const [logros, estadisticas, idsOtorgados] = await Promise.all([
        logroRepository.listarTodos(),
        logroRepository.obtenerEstadisticasUsuario(idUser),
        logroRepository.listarIdsOtorgados(idUser),
    ]);

    const fechaObtencion = fechaActualLima();
    const nuevosLogros = [];

    for (const logro of logros) {
        const idLogro = Number(logro.id_logro);
        if (idsOtorgados.has(idLogro)) continue;

        const progreso = estadisticas[logro.tipo_condicion];
        if (progreso >= Number(logro.valor_objetivo)) {
            const [, creado] = await logroRepository.otorgarUnaVez(
                idUser,
                idLogro,
                fechaObtencion,
                { transaction }
            );
            idsOtorgados.add(idLogro);
            if (!creado) continue;
            const logroOtorgado = logro.toJSON();
            nuevosLogros.push(logroOtorgado);
        }
    }

    return nuevosLogros;
}