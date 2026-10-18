import {
    procesarJSONTacho as procesarJSONTachoService,
    registrarResiduo as registrarResiduoService,
} from '../services/residuo.service.js';
import { exito } from '../utils/respuesta.js';

export const registrarResiduo = async (req, res, next) => {
    try {
        const payload = req.body;

        const residuo = await registrarResiduoService({
            ...payload,
            idUser: req.usuario.id_user,
        });

        return exito(res, residuo, 201);
    }
    catch (error) {
        return next(error);
    }
}

export async function recibirJSONTacho(req, res, next) {
    try {
        const residuo = await procesarJSONTachoService(req.body);
        return exito(res, residuo, 201);
    } catch (error) {
        return next(error);
    }
}