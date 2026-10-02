import {EventEmitter} from 'node:events';
const eventos = new EventEmitter();

export const EVENTOS = {
    RESIDUO_REGISTRADO: 'residuo-registrado',
}

export default eventos