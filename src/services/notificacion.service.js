import AppError from '../utils/AppError.js';
import NotificacionRepository from '../repositories/notificacion.repository.js';
import ConfiguracionRanking from '../models/ConfiguracionRanking.js';
import RankingTop10 from '../models/RankingTop10.js';
import { obtenerRangoMes, mesLimaDeFecha } from '../utils/periodo.js';
import Usuario from '../models/Usuario.js';
import { obtenerRanking } from './ranking.service.js';

const notificacionRepository = new NotificacionRepository();

export async function obtenerNotificaciones(idUser) {
    return notificacionRepository.listarPorUsuario(idUser);
}

export async function notificarSistema(data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new AppError('Los datos de la notificación no son válidos', 400);
    }
    const camposDesconocidos = Object.keys(data)
        .filter((campo) => !['id_user', 'titulo', 'mensaje'].includes(campo));
    if (camposDesconocidos.length > 0) {
        throw new AppError(`Campos no permitidos: ${camposDesconocidos.join(', ')}`, 400);
    }

    const idUser = typeof data.id_user === 'boolean' ? Number.NaN : Number(data.id_user);
    const titulo = typeof data.titulo === 'string' ? data.titulo.trim() : '';
    const mensaje = typeof data.mensaje === 'string' ? data.mensaje.trim() : '';

    if (!Number.isSafeInteger(idUser) || idUser <= 0) {
        throw new AppError('id_user debe ser un entero positivo', 400);
    }
    if (!titulo) throw new AppError('El título es obligatorio', 400);
    if (!mensaje) throw new AppError('El mensaje es obligatorio', 400);

    const usuario = await Usuario.findByPk(idUser, { attributes: ['id_user'] });
    if (!usuario) throw new AppError('Usuario no encontrado', 404);

    return notificacionRepository.crear({
        id_user: idUser,
        tipo: 'sistema',
        titulo,
        mensaje,
        fecha: new Date(),
        leida: false,
    });
}

async function procesarResiduo({ idUser, idResiduo, tipo, peso, puntosGanados }, transaction) {
    if (!Number.isSafeInteger(Number(idResiduo)) || Number(idResiduo) <= 0) {
        throw new Error('El evento de reciclaje no tiene una referencia válida');
    }
    const notificacion = await notificacionRepository.crearUnaVez(`residuo:${idResiduo}`, {
        id_user: idUser,
        tipo: 'reciclaje',
        titulo: 'Reciclaje registrado',
        mensaje: `Registraste ${peso} kg de ${tipo} y ganaste ${puntosGanados} puntos.`,
        fecha: new Date(),
        leida: false,
    }, { transaction });
    return notificacion;
}

async function procesarEntradaTop10(payload, transaction) {
    const periodo = mesLimaDeFecha(payload.fecha);
    const rango = obtenerRangoMes(periodo);
    const configuracion = await ConfiguracionRanking.findByPk(1, {
        transaction,
        lock: transaction.LOCK.UPDATE,
    });
    if (!configuracion) throw new Error('Falta la configuración inicial del ranking');

    const ranking = await obtenerRanking(payload.idUser, rango);
    const anteriores = await RankingTop10.findAll({
        where: { periodo },
        attributes: ['id_user'],
        raw: true,
        transaction,
    });
    const idsAnteriores = new Set(anteriores.map(({ id_user }) => Number(id_user)));
    const actuales = ranking.top.map(({ id_user }) => Number(id_user));
    const ingresaron = actuales.filter((idUser) => !idsAnteriores.has(idUser));

    await RankingTop10.destroy({ where: { periodo }, transaction });
    if (actuales.length > 0) {
        await RankingTop10.bulkCreate(
            actuales.map((id_user) => ({ periodo, id_user })),
            { transaction }
        );
    }

    await Promise.all(ingresaron.map((idUser) => (
        notificacionRepository.crearUnaVez(
            `top10:${periodo}:${idUser}:${payload.idResiduo}`,
            {
                id_user: idUser,
                tipo: 'ranking',
                titulo: 'Ingresaste al top 10',
                mensaje: `Ingresaste al top 10 del período ${periodo}.`,
                fecha: new Date(),
                leida: false,
            },
            { transaction }
        )
    )));
}

async function procesarLogro({ idUser, idLogro, nombre }, transaction) {
    return notificacionRepository.crearUnaVez(`logro:${idUser}:${idLogro}`, {
        id_user: idUser,
        tipo: 'logro',
        titulo: 'Nuevo logro obtenido',
        mensaje: `Obtuviste el logro "${nombre}".`,
        fecha: new Date(),
        leida: false,
    }, { transaction });
}

async function procesarCanje({ idUser, idCanje, nombrePremio }, transaction) {
    if (!Number.isSafeInteger(Number(idCanje)) || Number(idCanje) <= 0) {
        throw new Error('El evento de canje no tiene una referencia válida');
    }
    return notificacionRepository.crearUnaVez(`canje:${idCanje}`, {
        id_user: idUser,
        tipo: 'sistema',
        titulo: 'Premio canjeado',
        mensaje: `Canjeaste el premio "${nombrePremio}".`,
        fecha: new Date(),
        leida: false,
    }, { transaction });
}

async function procesarRegistro({ idUser, nombre }, transaction) {
    const administradores = await notificacionRepository.listarUsuariosPorTipo('admin', {
        transaction,
    });
    return notificacionRepository.crearVariasUnaVez(
        administradores.map(({ id_user }) => ({
            referencia_evento: `registro:${idUser}:admin:${id_user}`,
            id_user,
            tipo: 'sistema',
            titulo: 'Nuevo usuario registrado',
            mensaje: `Se registró el usuario "${nombre}".`,
            fecha: new Date(),
            leida: false,
        })),
        { transaction }
    );
}

async function procesarPremioNuevo({ idPremio, nombre }, transaction) {
    const usuarios = await notificacionRepository.listarUsuariosPorTipo('usuario', {
        transaction,
    });
    return notificacionRepository.crearVariasUnaVez(
        usuarios.map(({ id_user }) => ({
            referencia_evento: `premio:${idPremio}:usuario:${id_user}`,
            id_user,
            tipo: 'sistema',
            titulo: 'Nuevo premio disponible',
            mensaje: `Se agregó el premio "${nombre}".`,
            fecha: new Date(),
            leida: false,
        })),
        { transaction }
    );
}

export async function procesarEventoNotificacion(tipo, payload, { transaction } = {}) {
    if (!transaction) throw new Error('Procesar una notificación requiere una transacción');
    switch (tipo) {
        case 'residuo.registrado':
            await procesarResiduo(payload, transaction);
            return procesarEntradaTop10(payload, transaction);
        case 'logro.otorgado':
            return procesarLogro(payload, transaction);
        case 'premio.canjeado':
            return procesarCanje(payload, transaction);
        case 'usuario.registrado':
            return procesarRegistro(payload, transaction);
        case 'premio.creado':
            return procesarPremioNuevo(payload, transaction);
        default:
            throw new Error(`No hay consumidor de notificaciones para ${tipo}`);
    }
}
