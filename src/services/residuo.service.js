import eventos, { EVENTOS } from '../utils/eventos.js';
import sequelize from '../config/db.js';
import AppError from '../utils/AppError.js';
import Residuo from '../models/Residuo.js';
import HistorialReciclaje from '../models/HistorialReciclaje.js';
import Usuario from '../models/Usuario.js';
import { calcularPuntos } from '../formulas/calcularPuntos.js';

async function siguienteId(modelo, campo, tabla, transaction) {
  await sequelize.query(`LOCK TABLE "${tabla}" IN EXCLUSIVE MODE`, { transaction });
  const ultimoId = await modelo.max(campo, { transaction });
  return Number(ultimoId ?? 0) + 1;
}

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
    const idResiduo = await siguienteId(Residuo, 'id_residuo', 'residuo', transaction);
    const residuo = await Residuo.create({
      id_residuo: idResiduo,
      peso: pesoNumero,
      tipo: String(tipo),
      id_user: Number(idUser),
      id_tacho: Number(idTacho),
    }, { transaction });

    const idHistorial = await siguienteId(
      HistorialReciclaje,
      'id_historial',
      'historialreciclaje',
      transaction
    );
    await HistorialReciclaje.create({
      id_historial: idHistorial,
      fecha: new Date(),
      id_user: Number(idUser),
      id_tacho: Number(idTacho),
      id_residuo: residuo.id_residuo,
    }, { transaction });

    const puntosGanados = calcularPuntos(pesoNumero);
    const fecha = new Date();

    await Usuario.increment('puntos', {
      by: puntosGanados,
      where: { id_user: Number(idUser) },
      transaction,
    });

    await transaction.commit();

    eventos.emit(EVENTOS.RESIDUO_REGISTRADO, {
      idUser: Number(idUser),
      idResiduo: residuo.id_residuo,
      idTacho: Number(idTacho),
      tipo: String(tipo),
      peso: pesoNumero,
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