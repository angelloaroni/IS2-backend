import Usuario from '../models/Usuario.js';

class RankingRepository {
    async listarUsuarios() {
        return Usuario.findAll({
            where: { estado: true },
            attributes: ['id_user', 'nombre', 'puntos'],
            order: [['puntos', 'DESC'], ['id_user', 'ASC']],
            raw: true,
        });
    }
}

export default RankingRepository;