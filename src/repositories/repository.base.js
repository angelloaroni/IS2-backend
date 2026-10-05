import AppError from '../utils/AppError.js';

class RepositoryBase {
    constructor(model) {
        this.model = model;
    }

    async findAll({ where = {}, attributes = null, include = null, order = [['id','ASC']], limit = null, offset = null } = {}) {
        const options = { where, order };
        if (attributes) options.attributes = attributes;
        if (include) options.include = include;
        if (limit !== null) options.limit = limit;
        if (offset !== null) options.offset = offset;
        return this.model.findAll(options);
    }

    async findById(id, { include = null } = {}) {
        const options = {};
        if (include) options.include = include;
        const instance = await this.model.findByPk(id, options);
        if (!instance) throw new AppError('Recurso no encontrado', 404);
        return instance;
    }

    async findOne(where = {}, { include = null } = {}) {
        const options = { where };
        if (include) options.include = include;
        return this.model.findOne(options);
    }

    async create(data, { transaction = null } = {}) {
        const options = {};
        if (transaction) options.transaction = transaction;
        return this.model.create(data, options);
    }

    async updateById(id, data, { transaction = null } = {}) {
        const instance = await this.model.findByPk(id);
        if (!instance) throw new AppError('Recurso no encontrado', 404);
        return instance.update(data, { transaction });
    }

    async deleteById(id, { transaction = null } = {}) {
        const instance = await this.model.findByPk(id);
        if (!instance) throw new AppError('Recurso no encontrado', 404);
        await instance.destroy({ transaction });
        return true;
    }

    async count(where = {}) {
        return this.model.count({ where });
    }
}

export default RepositoryBase;
