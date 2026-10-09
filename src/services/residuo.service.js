import eventos, {EVENTOS} from "../utils/eventos.js";
import sequelize from '../config/db.js';
import AppError from '../utils/AppError.js';
import Residuo from '../models/Residuo.js';
import HistorialReciclaje from '../models/HistorialReciclaje.js';
import Usuario from '../models/Usuario.js';
import { calcularPuntos } from '../formulas/calcularPuntos.js';

//logica que iria al confirmar la trannsacion
export async function registrarResiduo(data){
  const { idUser, idTacho, tipo, peso } = data;
  if (!idUser || !idTacho || !tipo || !peso) {
    throw new AppError('Faltan datos obligatorios', 400);
  }

  if (Number(peso) <= 0) {
    throw new AppError('El peso debe ser mayor a cero', 400);
  }

  const transaction = await sequelize.transaction();

  try {
    const residuo = await Residuo.create({
      peso,
      tipo,
      id_user,
      id_tacho,
    }, { transaction });

    await HistorialReciclaje.create({
      fecha: new Date(),
      id_user,
      id_tacho,
      id_residuo: residuo.id_residuo,
    }, { transaction });

    const puntosGanados = calcularPuntos(Number(peso));

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

  


//lo q iria despyes de eso seria esto
eventos.emit(EVENTOS.RESIDUO_REGISTRADO, {
  idUser,
  idResiduo,
  idTacho,
  puntosGanados,
  fecha,
});