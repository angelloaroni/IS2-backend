import Usuario from '../models/Usuario.js';
import RepositoryBase from './repository.base.js';
import AppError from '../utils/AppError.js';

class UsuarioRepository extends RepositoryBase {
    constructor() { super (Usuario); }

    async buscarPorId(id){
        return this.findById(id);
    }

    async sumarPuntos(id, puntos){
        const usuario = await this.model.findByPk(id);
        if (!usuario){
            throw new AppError("No se ha encontrado el usuario", 404);
        }

        await usuario.increment('puntos', { by: puntos });
        return usuario.reload();
    }

    async restarPuntos(id, puntos){
        const usuario = await this.model.findByPk(id);
        if (!usuario){
            throw new AppError("No se ha encontrado el usuario", 404);
        }

        await usuario.decrement('puntos', { by: puntos });
        return usuario.reload();    
    }
}

export default UsuarioRepository;