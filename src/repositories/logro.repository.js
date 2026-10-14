import { Op } from 'sequelize';
import Logro from '../models/Logro.js';
import LogrosUsuario from '../models/LogrosUsuario.js';
import Residuo from '../models/Residuo.js';
import Usuario from '../models/Usuario.js';

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
        const [cantidadResiduos, pesoTotal, usuario] = await Promise.all([
            Residuo.count({ where: { id_user: idUser } }),
            Residuo.sum('peso', { where: { id_user: idUser } }),
            Usuario.findByPk(idUser, { attributes: ['puntos'] }),
        ]);

        if (!usuario) {
            throw new Error(`No se encontró el usuario ${idUser} al evaluar sus logros`);
        }

        return {
            cantidad_residuos: Number(cantidadResiduos),
            puntos_acumulados: Number(usuario.puntos),
            peso_total_kg: Number(pesoTotal ?? 0),
        };
    }

    async listarIdsOtorgados(idUser) {
        const otorgados = await LogrosUsuario.findAll({
            where: { id_user: idUser },
            attributes: ['id_logro'],
            raw: true,
        });
        return new Set(otorgados.map(({ id_logro }) => Number(id_logro)));
    }

    async otorgar(idUser, idLogro, fecha) {
        return LogrosUsuario.create({
            id_user: idUser,
            id_logro: idLogro,
            fecha_obtencion: fecha,
        });
    }
}

export default LogroRepository;