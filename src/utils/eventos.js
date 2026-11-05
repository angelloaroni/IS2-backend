import {EventEmitter} from 'node:events';
const eventos = new EventEmitter();

export const EVENTOS = {
    RESIDUO_REGISTRADO: 'residuo.registrado',
    LOGRO_OTORGADO: 'logro.otorgado',
    PREMIO_CANJEADO: 'premio.canjeado',
    USUARIO_REGISTRADO: 'usuario.registrado',
    PREMIO_CREADO: 'premio.creado',
};

export default eventos