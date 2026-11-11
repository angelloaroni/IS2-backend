import sequelize from '../config/db.js';
import AppError from '../utils/AppError.js';
import eventos, { EVENTOS } from '../utils/eventos.js';
import historialRepository from '../repositories/historial.repository.js';
import residuoRepository from '../repositories/residuo.repository.js';
import tachoRepository from '../repositories/tacho.repository.js';
import UsuarioRepository from '../repositories/usuario.repository.js';
import { calcularPuntos, validarRegistroResiduo } from './puntos.service.js';
import eventoRepository from '../repositories/evento.repository.js';
import mqttEventoRepository from '../repositories/mqtt-evento.repository.js';
import { fechaActualLima } from '../utils/periodo.js';

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
  const idEvento = typeof eventoEntrada === 'string' ? eventoEntrada.trim() : '';
  const coincidencia = /^tacho-([1-3])-evento-([1-9]\d*)$/.exec(idEvento);
  const numeroEvento = coincidencia ? Number(coincidencia[2]) : Number.NaN;
  const idTachoNumero = idTacho;

  if (
    typeof data.codUser !== 'string'
    || !/^\d{8}$/.test(data.codUser)
  ) {
    throw new AppError('codUser debe contener exactamente 8 dígitos', 400);
  }
  if (
    typeof idTachoNumero !== 'number'
    || !Number.isInteger(idTachoNumero)
    || idTachoNumero < 1
    || idTachoNumero > 3
  ) {
    throw new AppError('idTacho debe ser 1, 2 o 3', 400);
  }
  if (!coincidencia || idEvento.length > 128 || !Number.isSafeInteger(numeroEvento)) {
    throw new AppError(
      'idEvento debe tener el formato tacho-{idTacho}-evento-{numero}',
      400
    );
  }
  if (Number(coincidencia[1]) !== idTachoNumero) {
    throw new AppError('El idTacho de idEvento no coincide con idTacho', 400);
  }

  return {
    idEvento,
    codUser: data.codUser,
    idTacho: idTachoNumero,
    numeroEvento,
    tipo: data.tipo,
    peso: data.peso,
  };
}

export async function procesarJSONTacho(data) {
  const mensaje = validarMensajeTacho(data);
  try {
    validarRegistroResiduo({
      idTacho: mensaje.idTacho,
      tipo: mensaje.tipo,
      peso: mensaje.peso,
      idempotencyKey: mensaje.idEvento,
    }, { requerirUsuario: false });
  } catch (error) {
    const existente = await residuoRepository.buscarPorClaveIdempotencia(mensaje.idEvento);
    if (existente) {
      throw new AppError(
        'Conflicto MQTT: idEvento ya existe con datos diferentes',
        409
      );
    }
    throw error;
  }

  const usuarioRepository = new UsuarioRepository();
  const usuario = await usuarioRepository.buscarPorCodigo(mensaje.codUser);
  if (!usuario || usuario.estado !== true) {
    const existente = await residuoRepository.buscarPorClaveIdempotencia(mensaje.idEvento);
    if (existente && !usuario) {
      throw new AppError(
        'Conflicto MQTT: idEvento ya existe con datos diferentes',
        409
      );
    }
    if (!existente) {
      throw new AppError('Usuario no encontrado o inactivo', 404);
    }
  }

  return registrarResiduo({
    idUser: usuario.id_user,
    idTacho: mensaje.idTacho,
    tipo: mensaje.tipo,
    peso: mensaje.peso,
    idempotencyKey: mensaje.idEvento,
  }, {
    numeroEvento: mensaje.numeroEvento,
    codUser: mensaje.codUser,
    usuarioInactivoStatus: 404,
  });
}

export async function registrarResiduo(data, {
  numeroEvento,
  codUser,
  usuarioInactivoStatus = 403,
} = {}) {
  const eventoSecuenciado = numeroEvento !== undefined;
  const registro = eventoSecuenciado
    ? null
    : validarRegistroResiduo(data, { requerirUsuario: !codUser });
  const idTacho = eventoSecuenciado ? data.idTacho : registro.idTacho;
  const tipo = eventoSecuenciado ? data.tipo : registro.tipo;
  const peso = eventoSecuenciado ? data.peso : registro.peso;
  const idempotencyKey = eventoSecuenciado
    ? data.idempotencyKey
    : registro.idempotencyKey;
  const usuarioRepository = new UsuarioRepository();

  const transaction = await sequelize.transaction();

  try {
    if (eventoSecuenciado) {
      await mqttEventoRepository.bloquearSecuencia(idTacho, { transaction });
    }

    const existente = await residuoRepository.buscarPorClaveIdempotencia(
      idempotencyKey,
      { transaction }
    );
    if (existente) {
      if (codUser) {
        const usuarioExistente = await usuarioRepository.buscarPorCodigo(
          codUser,
          { transaction, lock: true }
        );
        const esDuplicadoIdentico = usuarioExistente
          && Number(existente.id_user) === Number(usuarioExistente.id_user)
          && Number(existente.id_tacho) === idTacho
          && existente.tipo === tipo
          && Number(existente.peso) === peso;
        if (esDuplicadoIdentico) {
          await transaction.commit();
          return { duplicado: true, idempotencyKey };
        }
        throw new AppError(
          'Conflicto MQTT: idEvento ya existe con datos diferentes',
          409
        );
      }
      throw new AppError('La clave de idempotencia ya fue utilizada', 409);
    }

    const registroValidado = registro
      || validarRegistroResiduo(data, { requerirUsuario: false });
    const { idUser } = registroValidado;
    const usuario = codUser
      ? await usuarioRepository.buscarPorCodigo(
        codUser,
        { transaction, lock: true }
      )
      : await usuarioRepository.buscarPorId(idUser, { transaction });
    if (!usuario) {
      throw new AppError('Usuario no encontrado o inactivo', 404);
    }
    if (usuario.estado !== true) {
      throw new AppError('El usuario está inactivo', usuarioInactivoStatus);
    }
    await tachoRepository.buscarActivoPorId(idTacho, { transaction });

    const idUserReal = codUser ? usuario.id_user : idUser;
    const fecha = new Date();
    const fechaLima = fechaActualLima(fecha);
    const puntosGanados = calcularPuntos(peso, tipo);
    const residuo = await residuoRepository.crear({
      peso,
      puntos_ganados: puntosGanados,
      tipo,
      idempotency_key: idempotencyKey,
      id_user: idUserReal,
      id_tacho: idTacho,
    }, { transaction });

    await historialRepository.crear({
      fecha: fechaLima,
      fecha_instante: fecha,
      id_user: idUserReal,
      id_tacho: idTacho,
      id_residuo: residuo.id_residuo,
    }, { transaction });

    await usuarioRepository.sumarPuntos(idUserReal, puntosGanados, { transaction });

    const evento = {
      idUser: idUserReal,
      idResiduo: residuo.id_residuo,
      idTacho,
      tipo,
      peso,
      puntosGanados,
      fecha,
    };
    await eventoRepository.registrar({
      tipo: 'residuo.registrado',
      referencia: `residuo:${residuo.id_residuo}`,
      payload: evento,
    }, { transaction });

    if (eventoSecuenciado) {
      await mqttEventoRepository.actualizarSecuencia(
        idTacho,
        numeroEvento,
        { transaction }
      );
    }

    await transaction.commit();

    // Los listeners R1 se conservan hasta la conexión coordinada de Fase 2.
    eventos.emit(EVENTOS.RESIDUO_REGISTRADO, evento);

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
