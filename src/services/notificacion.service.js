import AppError from '../utils/AppError.js';
import NotificacionRepository from '../repositories/notificacion.repository.js';
import Usuario from '../models/Usuario.js';
import eventos, { EVENTOS } from '../utils/eventos.js';

const notificacionRepository = new NotificacionRepository();

export async function obtenerNotificaciones(idUser) {
    return notificacionRepository.listarPorUsuario(idUser);
}

export async function notificarSistema({ id_user, titulo, mensaje } = {}) {
    const idUser = Number(id_user);
    const tituloNormalizado = String(titulo ?? '').trim();
    const mensajeNormalizado = String(mensaje ?? '').trim();

    if (!Number.isSafeInteger(idUser) || idUser <= 0) {
        throw new AppError('id_user debe ser un entero positivo', 400);
    }
    if (!tituloNormalizado) throw new AppError('El título es obligatorio', 400);
    if (!mensajeNormalizado) throw new AppError('El mensaje es obligatorio', 400);

    const usuario = await Usuario.findByPk(idUser, { attributes: ['id_user'] });
    if (!usuario) throw new AppError('Usuario no encontrado', 404);

    return notificacionRepository.crear({
        id_user: idUser,
        tipo: 'sistema',
        titulo: tituloNormalizado,
        mensaje: mensajeNormalizado,
        fecha: new Date(),
        leida: false,
    });
}

export async function notificarReciclaje({ idUser, tipo, peso, puntosGanados }) {
    return notificacionRepository.crear({
        id_user: idUser,
        tipo: 'reciclaje',
        titulo: 'Reciclaje registrado',
        mensaje: `Registraste ${peso} kg de ${tipo} y ganaste ${puntosGanados} puntos.`,
        fecha: new Date(),
        leida: false,
    });
}

eventos.on(EVENTOS.RESIDUO_REGISTRADO, async (payload) => {
    try {
        await notificarReciclaje(payload);
    } catch (error) {
        console.error('Error guardando la notificación de reciclaje:', error);
    }
});

eventos.on(EVENTOS.LOGRO_OTORGADO, async ({ idUser, nombre }) => {
    try {
        await notificacionRepository.crear({
            id_user: idUser,
            tipo: 'logro',
            titulo: 'Nuevo logro obtenido',
            mensaje: `Obtuviste el logro "${nombre}".`,
            fecha: new Date(),
            leida: false,
        });
    } catch (error) {
        console.error('Error guardando la notificación de logro:', error);
    }
});

eventos.on(EVENTOS.PREMIO_CANJEADO, async ({ idUser, nombrePremio }) => {
    try {
        await notificacionRepository.crear({
            id_user: idUser,
            tipo: 'sistema',
            titulo: 'Premio canjeado',
            mensaje: `Canjeaste el premio "${nombrePremio}".`,
            fecha: new Date(),
            leida: false,
        });
    } catch (error) {
        console.error('Error guardando la notificación de canje:', error);
    }
});