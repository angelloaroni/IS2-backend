import { Op } from 'sequelize';
import Usuario from '../models/Usuario.js';

class RankingRepository {
    async listarUsuariosElegibles() {
        return Usuario.findAll({
            where: { estado: true, tipo: 'usuario' },
            attributes: ['id_user', 'nombre'],
            order: [['id_user', 'ASC']],
            raw: true,
        });
    }

    async existenUsuariosTipoUsuario(ids) {
        if (ids.length === 0) return true;
        const encontrados = await Usuario.findAll({
            where: {
                id_user: { [Op.in]: ids },
                tipo: 'usuario',
            },
            attributes: ['id_user'],
            raw: true,
        });
        return encontrados.length === ids.length;
    }
}

export default RankingRepository;
