import AppError from '../utils/AppError.js';
import { validarFiltrosActividad } from '../utils/filtrosActividad.js';
import metricaRepository from '../repositories/metrica.repository.js';

export async function obtenerMetricas(idUser, filtros = {}) {
    const id = Number(idUser);
    if (!Number.isSafeInteger(id) || id <= 0) throw new AppError('El usuario no es válido', 400);
    return metricaRepository.obtenerPorUsuario(id, validarFiltrosActividad(filtros, { permitirMaterial: true }));
}
