import Notificacion from '../models/Notificacion.js';

class NotificacionRepository {
    async listarPorUsuario(idUser) {
        return Notificacion.findAll({
            where: { id_user: idUser },
            order: [['fecha', 'DESC'], ['id_notificacion', 'DESC']],
            raw: true,
        });
    }

    async crear(data) {
        return Notificacion.create(data);
    }
}

export default NotificacionRepository;
