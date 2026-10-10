import eventos, { EVENTOS } from '../utils/eventos.js';
import sequelize from '../config/db.js';
import AppError from '../utils/AppError.js';
import Residuo from '../models/Residuo.js';
import HistorialReciclaje from '../models/HistorialReciclaje.js';
import { calcularPuntos } from '../formulas/calcularPuntos.js';

export async function registrarResiduo(data) {
  const { idUser, idTacho, tipo, peso } = data;

  if (!idUser || !idTacho || !tipo || peso === undefined || peso === null) {
    throw new AppError('Faltan datos obligatorios', 400);
  }

  const pesoNumero = Number(peso);
  if (!Number.isFinite(pesoNumero) || pesoNumero <= 0) {
    throw new AppError('El peso debe ser mayor a cero', 400);
  }

  const transaction = await sequelize.transaction();

  try {
    const residuo = await Residuo.create({
      nombre: String(tipo),
      peso: pesoNumero,
      tipo: String(tipo),
      id_user: Number(idUser),
      id_tacho: Number(idTacho),
    }, { transaction });

    await HistorialReciclaje.create({
      fecha: new Date(),
      id_user: Number(idUser),
      id_tacho: Number(idTacho),
      id_residuo: residuo.id_residuo,
    }, { transaction });

    const puntosGanados = calcularPuntos(pesoNumero);
    const fecha = new Date();

    await transaction.commit();

    eventos.emit(EVENTOS.RESIDUO_REGISTRADO, {
      idUser: Number(idUser),
      idResiduo: residuo.id_residuo,
      idTacho: Number(idTacho),
      puntosGanados,
      fecha,
    });

    return {
      ...residuo.toJSON(),
      puntosGanados,
      fecha,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}