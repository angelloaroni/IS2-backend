import Notificacion from '../models/Notificacion.js';
import Usuario from '../models/Usuario.js';

class NotificacionRepository {
    async listarPorUsuario(idUser) {
        return Notificacion.findAll({
            where: { id_user: idUser },
            order: [['fecha', 'DESC'], ['id_notificacion', 'DESC']],
            raw: true,
        });
    }

    async marcarLeidasPorUsuario(idUser) {
        return Notificacion.update(
            { leida: true },
            { where: { id_user: idUser, leida: false } }
        );
    }

    async crear(data) {
        return Notificacion.create(data);
    }

    async crearUnaVez(referenciaEvento, data, { transaction = null } = {}) {
        const [notificacion] = await Notificacion.findOrCreate({
            where: { referencia_evento: referenciaEvento },
            defaults: { ...data, referencia_evento: referenciaEvento },
            transaction,
        });
        return notificacion;
    }

    async crearVariasUnaVez(notificaciones, { transaction = null } = {}) {
        const creadas = [];
        for (let inicio = 0; inicio < notificaciones.length; inicio += 500) {
            const lote = await Notificacion.bulkCreate(
                notificaciones.slice(inicio, inicio + 500),
                { transaction, ignoreDuplicates: true }
            );
            creadas.push(...lote);
        }
        return creadas;
    }

    async listarUsuariosPorTipo(tipo, { transaction = null } = {}) {
        return Usuario.findAll({
            where: { estado: true, tipo },
            attributes: ['id_user'],
            transaction,
            raw: true,
        });
    }
}

export default NotificacionRepository;
