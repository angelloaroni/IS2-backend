import sequelize from '../config/db.js';
import ConfiguracionRanking from '../models/ConfiguracionRanking.js';
import UsuarioExcluidoRanking from '../models/UsuarioExcluidoRanking.js';

class ConfiguracionRankingRepository {
    async obtener() {
        const [configuracion, excluidos] = await Promise.all([
            ConfiguracionRanking.findByPk(1, { raw: true }),
            UsuarioExcluidoRanking.findAll({
                attributes: ['id_user'],
                order: [['id_user', 'ASC']],
                raw: true,
            }),
        ]);

        if (!configuracion) {
            throw new Error('Falta la configuración inicial del ranking');
        }
        return {
            desde: configuracion.desde,
            hasta: configuracion.hasta,
            excluidos: excluidos.map(({ id_user }) => Number(id_user)),
        };
    }

    async guardar({ desde, hasta, excluidos }) {
        return sequelize.transaction(async (transaction) => {
            const configuracion = await ConfiguracionRanking.findByPk(1, {
                transaction,
                lock: transaction.LOCK.UPDATE,
            });
            if (!configuracion) {
                throw new Error('Falta la configuración inicial del ranking');
            }

            await configuracion.update({ desde, hasta }, { transaction });
            await UsuarioExcluidoRanking.destroy({ where: {}, transaction });
            if (excluidos.length > 0) {
                await UsuarioExcluidoRanking.bulkCreate(
                    excluidos.map((id_user) => ({ id_user })),
                    { transaction }
                );
            }
            return {
                desde,
                hasta,
                excluidos: [...excluidos].sort((a, b) => a - b),
            };
        });
    }
}

export default new ConfiguracionRankingRepository();
