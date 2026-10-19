import TachoInteligente from '../models/TachoInteligente.js';
import AppError from '../utils/AppError.js';
import sequelize from '../config/db.js';
import { Op } from 'sequelize';

class TachoRepository {
    async listarActivos() {
        return TachoInteligente.findAll({
            where: { estado: true },
            order: [['id_tacho', 'ASC']],
        });
    }

    async buscarActivosEnRectangulo({ latitudMinima, latitudMaxima, longitud }) {
        const condiciones = [
            { estado: true },
            { latitud: { [Op.between]: [latitudMinima, latitudMaxima] } },
        ];

        if (longitud) {
            if (longitud.cruzaAntimeridiano) {
                condiciones.push({
                    [Op.or]: [
                        { longitud: { [Op.gte]: longitud.minimaEnvuelta } },
                        { longitud: { [Op.lte]: longitud.maximaEnvuelta } },
                    ],
                });
            } else {
                condiciones.push({
                    longitud: { [Op.between]: [longitud.minima, longitud.maxima] },
                });
            }
        }

        return TachoInteligente.findAll({
            attributes: ['id_tacho', 'tipo', 'latitud', 'longitud', 'capacidad', 'porcentaje'],
            where: { [Op.and]: condiciones },
            order: [['id_tacho', 'ASC']],
        });
    }

    async buscarActivoPorId(id, { transaction = null } = {}) {
        const options = {
            where: { id_tacho: id, estado: true },
            transaction,
        };
        if (transaction) {
            options.lock = transaction.LOCK.UPDATE;
        }
        const tacho = await TachoInteligente.findOne(options);

        if (!tacho) {
            throw new AppError('Tacho no encontrado', 404);
        }
        return tacho;
    }

    async crear(data, { transaction }) {
        await sequelize.query(
            'LOCK TABLE "tachointeligente" IN EXCLUSIVE MODE',
            { transaction }
        );
        const ultimoId = await TachoInteligente.max('id_tacho', { transaction });
        return TachoInteligente.create({
            ...data,
            id_tacho: Number(ultimoId ?? 0) + 1,
            estado: true,
        }, { transaction });
    }

    async actualizar(id, data) {
        const tacho = await this.buscarActivoPorId(id);
        return tacho.update(data);
    }

    async darDeBaja(id) {
        const tacho = await this.buscarActivoPorId(id);
        await tacho.update({ estado: false });
        return tacho;
    }
}

export default new TachoRepository();