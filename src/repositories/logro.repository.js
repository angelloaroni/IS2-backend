import { Op } from 'sequelize';
import sequelize from '../config/db.js';
import Logro from '../models/Logro.js';
import LogrosUsuario from '../models/LogrosUsuario.js';
import { obtenerEstadisticasUsuario } from '../services/estadisticas.service.js';
import eventoRepository from './evento.repository.js';

class LogroRepository {
    async crear(data) {
        return Logro.create(data);
    }

    async buscarPorId(id) {
        return Logro.findByPk(id);
    }

    async buscarVariosPorId(ids) {
        if (ids.length === 0) return [];
        return Logro.findAll({
            where: { id_logro: { [Op.in]: ids } },
        });
    }

    async listarTodos() {
        return Logro.findAll({ order: [['id_logro', 'ASC']] });
    }

    async listarOtorgadosAUsuario(idUser) {
        return LogrosUsuario.findAll({
            where: { id_user: idUser },
            order: [['fecha_obtencion', 'DESC']],
            raw: true,
        });
    }

    async obtenerEstadisticasUsuario(idUser) {
        return obtenerEstadisticasUsuario(idUser);
    }

    async listarIdsOtorgados(idUser) {
        const otorgados = await LogrosUsuario.findAll({
            where: { id_user: idUser },
            attributes: ['id_logro'],
            raw: true,
        });
        return new Set(otorgados.map(({ id_logro }) => Number(id_logro)));
    }

    async otorgarUnaVez(idUser, idLogro, fecha, { transaction = null } = {}) {
        const otorgarEnTransaccion = async (tx) => {
            const resultado = await LogrosUsuario.findOrCreate({
                where: { id_user: idUser, id_logro: idLogro },
                defaults: { fecha_obtencion: fecha },
                transaction: tx,
            });
            if (resultado[1]) {
                await eventoRepository.registrar({
                    tipo: 'logro.otorgado',
                    referencia: `logro:${idUser}:${idLogro}`,
                    payload: {
                        idUser,
                        idLogro,
                        nombre: await this.nombrePorId(idLogro, tx),
                    },
                }, { transaction: tx });
            }
            return resultado;
        };

        return transaction
            ? otorgarEnTransaccion(transaction)
            : sequelize.transaction(otorgarEnTransaccion);
    }

    async nombrePorId(idLogro, transaction) {
        const logro = await Logro.findByPk(idLogro, {
            attributes: ['nombre'],
            transaction,
        });
        if (!logro) throw new Error(`No se encontró el logro ${idLogro}`);
        return logro.nombre;
    }
}

export default LogroRepository;