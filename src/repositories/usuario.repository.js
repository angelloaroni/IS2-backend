import Usuario from '../models/Usuario.js';
import RepositoryBase from './repository.base.js';
import AppError from '../utils/AppError.js';

class UsuarioRepository extends RepositoryBase {
    constructor() { super(Usuario); }

    async buscarPorCodigo(codUser, { transaction = null } = {}) {
        return this.model.findOne({
            where: { cod_user: String(codUser) },
            transaction,
        });
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

    async desactivarPorId(id) {
        const usuario = await this.buscarPorId(id);
        if (usuario.estado !== false) {
            await usuario.update({ estado: false });
        }
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
