import sequelize from '../config/db.js';
import AppError from '../utils/AppError.js';
import eventos, { EVENTOS } from '../utils/eventos.js';
import historialRepository from '../repositories/historial.repository.js';
import residuoRepository from '../repositories/residuo.repository.js';
import tachoRepository from '../repositories/tacho.repository.js';
import UsuarioRepository from '../repositories/usuario.repository.js';
import { calcularPuntos, validarRegistroResiduo } from './puntos.service.js';

export function validarMensajeTacho(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new AppError('El JSON del tacho no es válido', 400);
  }

  const camposPermitidos = new Set([
    'evento',
    'idEvento',
    'codUser',
    'idtacho',
    'idTacho',
    'tipo',
    'peso',
  ]);
  if (Object.keys(data).some((campo) => !camposPermitidos.has(campo))) {
    throw new AppError('El JSON del tacho contiene campos no permitidos', 400);
  }

  if (data.evento !== undefined && data.idEvento !== undefined) {
    throw new AppError('El mensaje debe incluir evento o idEvento, no ambos', 400);
  }
  if (data.idtacho !== undefined && data.idTacho !== undefined) {
    throw new AppError('El mensaje debe incluir idtacho o idTacho, no ambos', 400);
  }

  const eventoEntrada = data.evento ?? data.idEvento;
  const idTacho = data.idtacho ?? data.idTacho;
  const idEvento = typeof eventoEntrada === 'string' || Number.isSafeInteger(eventoEntrada)
    ? String(eventoEntrada).trim()
    : '';

  if (
    typeof data.codUser !== 'string'
    || !/^\d{8}$/.test(data.codUser)
  ) {
    throw new AppError('codUser debe contener exactamente 8 dígitos', 400);
  }
  if (!idEvento || idEvento.length > 128) {
    throw new AppError('evento debe ser un identificador único de hasta 128 caracteres', 400);
  }

  return {
    idEvento,
    codUser: data.codUser,
    idTacho,
    tipo: data.tipo,
    peso: data.peso,
  };
}

export async function procesarJSONTacho(data) {
  const mensaje = validarMensajeTacho(data);
  const usuarioRepository = new UsuarioRepository();
  const usuario = await usuarioRepository.buscarPorCodigo(mensaje.codUser);

  if (!usuario || usuario.estado !== true) {
    throw new AppError('Usuario no encontrado o inactivo', 404);
  }

  return registrarResiduo({
    idUser: usuario.id_user,
    idTacho: mensaje.idTacho,
    tipo: mensaje.tipo,
    peso: mensaje.peso,
    idempotencyKey: mensaje.idEvento,
  });
}

export async function registrarResiduo(data) {
  const registro = validarRegistroResiduo(data);
  const { idUser, idTacho, tipo, peso, idempotencyKey } = registro;
  const usuarioRepository = new UsuarioRepository();

  const transaction = await sequelize.transaction();

  try {
    const existente = await residuoRepository.buscarPorClaveIdempotencia(
      idempotencyKey,
      { transaction }
    );
    if (existente) {
      throw new AppError('La clave de idempotencia ya fue utilizada', 409);
    }

    const usuario = await usuarioRepository.buscarPorId(idUser, { transaction });
    if (usuario.estado !== true) {
      throw new AppError('El usuario está inactivo', 403);
    }
    await tachoRepository.buscarActivoPorId(idTacho, { transaction });

    const fecha = new Date();
    const puntosGanados = calcularPuntos(peso, tipo);
    const residuo = await residuoRepository.crear({
      peso,
      tipo,
      idempotency_key: idempotencyKey,
      id_user: idUser,
      id_tacho: idTacho,
    }, { transaction });

    await historialRepository.crear({
      fecha,
      id_user: idUser,
      id_tacho: idTacho,
      id_residuo: residuo.id_residuo,
    }, { transaction });

    await usuarioRepository.sumarPuntos(idUser, puntosGanados, { transaction });

    await transaction.commit();

    eventos.emit(EVENTOS.RESIDUO_REGISTRADO, {
      idUser,
      idResiduo: residuo.id_residuo,
      idTacho,
      tipo,
      peso,
      puntosGanados,
      fecha,
    });

    return {
      idResiduo: residuo.id_residuo,
      peso: residuo.peso,
      tipo: residuo.tipo,
      idUser: residuo.id_user,
      idTacho: residuo.id_tacho,
      puntosGanados,
      fecha,
    };
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new AppError('La clave de idempotencia ya fue utilizada', 409);
    }
    throw error;
  }
}