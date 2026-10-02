import { fallo } from '../utils/respuesta.js';

//segun lo que entiendo, toda esta parte es para que no se pueda acceder a la api sin estar logueado, es decir que se tenga que contar si o si 
//con un user id al mometno de etnrar a cauqlueri endpoint

export default function authMiddleware(req, res, next) {
    const headerUserId = req.get('x-user-id');
    if (!headerUserId) {
        return fallo(res, 'Falta el header x-user-id', 401);
    }
    const userId = Number(headerUserId);
    
    //si NO es entero, o si es negativo, se especifica que el user id debe ser positivo
    if (!Number.isInteger(userId) || userId <= 0) {
        return fallo(res, 'El header x-user-id debe ser un entero positivo', 401);
    }

  req.usuario = { id_user: userId };
  return next();
}