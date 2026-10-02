import AppError from '../utils/AppError.js';
import {fallo} from '../utils/respuesta.js';

export default function errorMiddleware(err, req, res, next){
    if (err instanceof AppError){
        return fallo(res, err.message, err.statusCode);
    }
    console.log(err);
    return fallo(res, 'Error interno dentro del servidor', 500);
}