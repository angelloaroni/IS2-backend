import { registrarResiduo as registrarResiduoService } from '../services/residuo.service.js';

export const registrarResiduo = async (req, res, next) => {
    try {
        const payload = req.body;

        const residuo = await registrarResiduoService({
            ...payload,
            idUser: req.usuario.id_user,
        })

        return res.status(201).json({
            ok: true,
            data: residuo,
            error: null,
        })
    }
    catch (error) {
        return next(error);
    }
}