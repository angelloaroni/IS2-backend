import Residuo from '../models/Residuo.js';
import sequelize from '../config/db.js';

class ResiduoRepository {
    async buscarPorClaveIdempotencia(idempotencyKey, { transaction } = {}) {
        return Residuo.findOne({
            where: { idempotency_key: idempotencyKey },
            transaction,
        });
    }

    async crear(data, { transaction }) {
        await sequelize.query(
            'LOCK TABLE "residuo" IN EXCLUSIVE MODE',
            { transaction }
        );
        const ultimoId = await Residuo.max('id_residuo', { transaction });
        return Residuo.create({
            ...data,
            id_residuo: Number(ultimoId ?? 0) + 1,
        }, { transaction });
    }
}

export default new ResiduoRepository();