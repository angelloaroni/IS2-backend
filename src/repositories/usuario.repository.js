import Usuario from '../models/Usuario.js';
import RepositoryBase from './repository.base.js';
import AppError from '../utils/AppError.js';
import { Op } from 'sequelize';

class UsuarioRepository extends RepositoryBase {
    constructor() { super(Usuario); }

    async buscarPorCodigo(codUser, { transaction = null, lock = false } = {}) {
        const options = {
            where: { cod_user: String(codUser) },
            transaction,
        };
        if (transaction && lock) {
            options.lock = transaction.LOCK.UPDATE;
        }
        return this.model.findOne(options);
    }

    async buscarPorCorreo(correoInstitucional, { transaction = null } = {}) {
        return this.model.findOne({
            where: { correo_institucional: correoInstitucional },
            transaction,
        });
    }

    async crearUsuario(data, { transaction = null } = {}) {
        return this.model.create(data, { transaction });
    }

    async buscarPorId(id, { transaction = null } = {}) {
        const options = { transaction };
        if (transaction) {
            options.lock = transaction.LOCK.UPDATE;
        }
        const usuario = await this.model.findByPk(id, options);
        if (!usuario) {
            throw new AppError('No se ha encontrado el usuario', 404);
        }
        return usuario;
    }

    async listarAdministracion({ busqueda, limit, offset }) {
        const where = {};
        if (busqueda) {
            where[Op.or] = [
                { nombre: { [Op.iLike]: `%${busqueda}%` } },
                { cod_user: { [Op.like]: `%${busqueda}%` } },
            ];
        }

        return this.model.findAndCountAll({
            where,
            attributes: [
                'id_user',
                'cod_user',
                'nombre',
                'puntos',
                'tipo',
                'correo_institucional',
                'estado',
            ],
            order: [['id_user', 'ASC']],
            limit,
            offset,
        });
    }

    async desactivarPorId(id) {
        const usuario = await this.buscarPorId(id);
        if (usuario.estado !== false) {
            await usuario.update({ estado: false });
        }
        return usuario;
    }

    async actualizarPorId(id, cambios) {
        const usuario = await this.buscarPorId(id);
        await usuario.update(cambios);
        return usuario;
    }

    async sumarPuntos(id, puntos, { transaction = null } = {}) {
        const usuario = await this.buscarPorId(id, { transaction });
        await usuario.increment('puntos', { by: puntos, transaction });
        return usuario.reload({ transaction });
    }

    async restarPuntos(id, puntos) {
        const usuario = await this.model.findByPk(id);
        if (!usuario) {
            throw new AppError('No se ha encontrado el usuario', 404);
        }

        await usuario.decrement('puntos', { by: puntos });
        return usuario.reload();
    }
}

export default UsuarioRepository;
