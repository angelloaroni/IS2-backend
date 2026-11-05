import AppError from '../utils/AppError.js';
import { validarFiltrosActividad } from '../utils/filtrosActividad.js';
import estadisticaRepository from '../repositories/estadistica.repository.js';

export async function obtenerEstadisticasUsuario(idUser, filtros = {}) {
    const id = Number(idUser);
    if (!Number.isSafeInteger(id) || id <= 0) throw new AppError('El usuario no es válido', 400);
    return estadisticaRepository.estadisticasUsuario(id, validarFiltrosActividad(filtros));
}

export async function listarActividadPorUsuario(filtros = {}) {
    return estadisticaRepository.listarActividad(validarFiltrosActividad(filtros));
}
