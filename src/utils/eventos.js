import {EventEmitter} from 'node:events';
const eventos = new EventEmitter();

export const EVENTOS = {
    RESIDUO_REGISTRADO: 'residuo.registrado',
    LOGRO_OTORGADO: 'logro.otorgado',
    PREMIO_CANJEADO: 'premio.canjeado',
}

export default eventos