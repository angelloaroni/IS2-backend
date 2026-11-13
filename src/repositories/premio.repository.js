import { Op } from 'sequelize';
import Premio from '../models/Premio.js';
import Usuario from '../models/Usuario.js';
import UsuarioPremio from '../models/UsuarioPremio.js';

class PremioRepository {
    async listar() {
        return Premio.findAll({ where: { estado: true }, order: [['id_premio', 'ASC']] });
    }

    async buscarPorId(id, options = {}) {
        return Premio.findByPk(id, options);
    }

    async buscarVariosPorId(ids) {
        if (ids.length === 0) return [];
        return Premio.findAll({ where: { id_premio: { [Op.in]: ids } } });
    }

    async crear(data, options = {}) {
        return Premio.create(data, options);
    }

    async siguienteId(modelo, campo, tabla, transaction) {
        await Premio.sequelize.query(`LOCK TABLE "${tabla}" IN EXCLUSIVE MODE`, { transaction });
        const ultimoId = await modelo.max(campo, { transaction });
        return Number(ultimoId ?? 0) + 1;
    }

    async bloquearUsuario(idUser, transaction) {
        return Usuario.findByPk(idUser, { transaction, lock: transaction.LOCK.UPDATE });
    }

    async bloquearPremio(idPremio, transaction) {
        return Premio.findOne({
            where: { id_premio: idPremio, estado: true },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
    }

    async listarCanjes(idUser) {
        return UsuarioPremio.findAll({
            where: { id_user: idUser },
            order: [['fecha_obtencion', 'DESC'], ['id_usuario_premio', 'DESC']],
            raw: true,
        });
    }

    async crearCanje(data, transaction) {
        return UsuarioPremio.create(data, { transaction });
    }
}

export default PremioRepository;
