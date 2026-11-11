import mqtt from 'mqtt';
import { actualizarEstadoTacho } from './tacho.service.js';
import { procesarJSONTacho } from './residuo.service.js';
import UsuarioRepository from '../repositories/usuario.repository.js';
import productoRepository from '../repositories/producto.repository.js';
import mqttEventoRepository from '../repositories/mqtt-evento.repository.js';
import AppError from '../utils/AppError.js';

const TEMA_ULTIMO_EVENTO_SOLICITUD = 'smartbin/events/last/request';
const TEMA_ULTIMO_EVENTO_RESPUESTA = 'smartbin/events/last/response';

export function iniciarRecepcionMqtt() {
    const url = process.env.MQTT_BROKER_URL || 'mqtt://192.168.0.105:1883';
    const temaEstado = process.env.MQTT_TOPIC_TACHO_ESTADO || 'smartbin/status';
    const temaReciclaje = process.env.MQTT_TOPIC_EVENTO_RECICLAJE || 'smartbin/recycle';
    const temaValidarEstudiante = process.env.MQTT_TOPIC_VALIDAR_ESTUDIANTE
        || 'smartbin/student/validate';
    const temaRespuestaEstudiante = process.env.MQTT_TOPIC_RESPUESTA_ESTUDIANTE
        || 'smartbin/student/response';
    const temaValidarProducto = process.env.MQTT_TOPIC_VALIDAR_PRODUCTO
        || 'smartbin/product/validate';
    const temaRespuestaProducto = process.env.MQTT_TOPIC_RESPUESTA_PRODUCTO
        || 'smartbin/product/response';

    const temas = [
        temaEstado,
        temaReciclaje,
        temaValidarEstudiante,
        temaRespuestaEstudiante,
        temaValidarProducto,
        temaRespuestaProducto,
        TEMA_ULTIMO_EVENTO_SOLICITUD,
        TEMA_ULTIMO_EVENTO_RESPUESTA,
    ];
    if (new Set(temas).size !== temas.length) {
        throw new Error('Los temas MQTT configurados deben ser distintos');
    }
    if (Boolean(process.env.MQTT_USERNAME) !== Boolean(process.env.MQTT_PASSWORD)) {
        throw new Error('MQTT_USERNAME y MQTT_PASSWORD deben configurarse juntos');
    }

    const options = process.env.MQTT_USERNAME
        ? {
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
        }
        : {};
    const cliente = mqtt.connect(url, options);

    cliente.on('connect', () => {
        cliente.subscribe(
            [
                temaEstado,
                temaReciclaje,
                temaValidarEstudiante,
                temaValidarProducto,
                TEMA_ULTIMO_EVENTO_SOLICITUD,
            ],
            { qos: 1 },
            (error) => {
                if (error) {
                    console.error('No se pudieron suscribir los temas MQTT de tachos:', error);
                    return;
                }
                console.info(
                    `Suscrito a temas MQTT: ${temaEstado}, ${temaReciclaje}, ${temaValidarEstudiante}, ${temaValidarProducto}, ${TEMA_ULTIMO_EVENTO_SOLICITUD}`
                );
            }
        );
    });

    cliente.on('message', (topic, payload) => {
        procesarMensaje(topic, payload, {
            cliente,
            temaEstado,
            temaReciclaje,
            temaValidarEstudiante,
            temaRespuestaEstudiante,
            temaValidarProducto,
            temaRespuestaProducto,
        }).catch((error) => {
            if (error.statusCode === 409) {
                console.error(`Conflicto de evento MQTT en "${topic}":`, error.message);
                return;
            }
            console.error(`No se pudo procesar el mensaje MQTT del tema "${topic}":`, error);
        });
    });

    cliente.on('error', (error) => {
        console.error('Error de conexión MQTT:', error);
    });

    return cliente;
}

export function validarMensajeValidacionEstudiante(data) {
    if (
        !data
        || typeof data !== 'object'
        || Array.isArray(data)
        || typeof data.codUser !== 'string'
        || !/^\d{8}$/.test(data.codUser)
    ) {
        throw new AppError('codUser debe contener exactamente 8 dígitos', 400);
    }

    return { codUser: data.codUser };
}

export function validarMensajeValidacionProducto(data) {
    if (
        !data
        || typeof data !== 'object'
        || Array.isArray(data)
        || typeof data.codProducto !== 'string'
        || !/^\d{8}$/.test(data.codProducto)
    ) {
        throw new AppError('codProducto debe contener exactamente 8 dígitos', 400);
    }

    return { codProducto: data.codProducto };
}

export function validarMensajeUltimoEvento(data) {
    if (
        !data
        || typeof data !== 'object'
        || Array.isArray(data)
        || Object.keys(data).length !== 1
        || !Number.isInteger(data.idTacho)
        || data.idTacho < 1
        || data.idTacho > 3
    ) {
        throw new AppError('idTacho debe ser 1, 2 o 3', 400);
    }
    return { idTacho: data.idTacho };
}

export async function procesarMensaje(topic, payload, {
    cliente,
    temaEstado,
    temaReciclaje,
    temaValidarEstudiante,
    temaRespuestaEstudiante,
    temaValidarProducto,
    temaRespuestaProducto,
    temaUltimoEventoSolicitud = TEMA_ULTIMO_EVENTO_SOLICITUD,
    temaUltimoEventoRespuesta = TEMA_ULTIMO_EVENTO_RESPUESTA,
}) {
    let data;
    try {
        data = JSON.parse(payload.toString('utf8'));
    } catch (error) {
        throw new Error(`JSON inválido recibido por MQTT en "${topic}"`, { cause: error });
    }

    if (topic === temaEstado) {
        await actualizarEstadoTacho(data);
        return;
    }
    if (topic === temaReciclaje) {
        const resultado = await procesarJSONTacho(data);
        if (resultado?.duplicado) {
            console.info(
                `Evento de reciclaje MQTT duplicado "${resultado.idempotencyKey}"; se omite`
            );
        }
        return;
    }
    if (topic === temaUltimoEventoSolicitud) {
        const { idTacho } = validarMensajeUltimoEvento(data);
        const lastEvent = await mqttEventoRepository.obtenerUltimoEvento(idTacho);
        const respuesta = JSON.stringify({ idTacho, lastEvent });
        await new Promise((resolve, reject) => {
            cliente.publish(temaUltimoEventoRespuesta, respuesta, { qos: 1 }, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
        return;
    }
    if (topic === temaValidarEstudiante) {
        const { codUser } = validarMensajeValidacionEstudiante(data);
        const usuarioRepository = new UsuarioRepository();
        const usuario = await usuarioRepository.buscarPorCodigo(codUser);
        const respuesta = JSON.stringify({ codUser, exists: Boolean(usuario) });
        await new Promise((resolve, reject) => {
            cliente.publish(temaRespuestaEstudiante, respuesta, { qos: 1 }, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
        return;
    }
    if (topic === temaValidarProducto) {
        const { codProducto } = validarMensajeValidacionProducto(data);
        const producto = await productoRepository.buscarPorCodigo(codProducto);
        const respuesta = JSON.stringify({ codProducto, ...producto });
        await new Promise((resolve, reject) => {
            cliente.publish(temaRespuestaProducto, respuesta, { qos: 1 }, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
        return;
    }

    throw new Error(`Mensaje recibido en un tema MQTT no reconocido: "${topic}"`);
}
