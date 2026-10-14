import AppError from '../utils/AppError.js';
import LogroRepository from '../repositories/logro.repository.js';
import eventos, { EVENTOS } from '../utils/eventos.js';

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
    const id = Number(data.id_logro);
    const nombre = String(data.nombre ?? '').trim();
    const tipoCondicion = String(data.tipo_condicion ?? '').trim().toLowerCase();
    const valorObjetivo = Number(data.valor_objetivo);

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

export async function evaluarLogros(idUser) {
    const [logros, estadisticas, idsOtorgados] = await Promise.all([
        logroRepository.listarTodos(),
        logroRepository.obtenerEstadisticasUsuario(idUser),
        logroRepository.listarIdsOtorgados(idUser),
    ]);

    const fechaObtencion = new Date().toISOString().slice(0, 10);
    const nuevosLogros = [];

    for (const logro of logros) {
        const idLogro = Number(logro.id_logro);
        if (idsOtorgados.has(idLogro)) continue;

        const progreso = estadisticas[logro.tipo_condicion];
        if (progreso >= Number(logro.valor_objetivo)) {
            await logroRepository.otorgar(idUser, idLogro, fechaObtencion);
            idsOtorgados.add(idLogro);
            const logroOtorgado = logro.toJSON();
            nuevosLogros.push(logroOtorgado);
            eventos.emit(EVENTOS.LOGRO_OTORGADO, {
                idUser,
                idLogro,
                nombre: logroOtorgado.nombre,
            });
        }
    }

    return nuevosLogros;
}

eventos.on(EVENTOS.RESIDUO_REGISTRADO, async ({ idUser }) => {
    try {
        const nuevosLogros = await evaluarLogros(idUser);
        if (nuevosLogros.length > 0) {
            console.info(`Logros otorgados al usuario ${idUser}: ${nuevosLogros.map(({ nombre }) => nombre).join(', ')}`);
        }
    } catch (error) {
        console.error('Error evaluando logros tras registrar un residuo:', error);
    }
});