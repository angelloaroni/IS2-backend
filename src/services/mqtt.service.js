import mqtt from 'mqtt';
import { actualizarEstadoTacho } from './tacho.service.js';
import { procesarJSONTacho } from './residuo.service.js';

export function iniciarRecepcionMqtt() {
    const url = process.env.MQTT_BROKER_URL || 'mqtt://192.168.18.143:1883';
    const temaEstado = process.env.MQTT_TOPIC_TACHO_ESTADO || 'smartbin/status';
    const temaReciclaje = process.env.MQTT_TOPIC_EVENTO_RECICLAJE || 'smartbin/recycle';

    if (temaEstado === temaReciclaje) {
        throw new Error('Los temas MQTT de estado y reciclaje deben ser distintos');
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
            [temaEstado, temaReciclaje],
            { qos: 1 },
            (error) => {
                if (error) {
                    console.error('No se pudieron suscribir los temas MQTT de tachos:', error);
                    return;
                }
                console.info(`Suscrito a temas MQTT: ${temaEstado}, ${temaReciclaje}`);
            }
        );
    });

    cliente.on('message', (topic, payload) => {
        procesarMensaje(topic, payload, { temaEstado, temaReciclaje }).catch((error) => {
            if (error.statusCode === 409) {
                console.info('Evento de reciclaje MQTT duplicado; se omite el registro');
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

async function procesarMensaje(topic, payload, { temaEstado, temaReciclaje }) {
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
        await procesarJSONTacho(data);
        return;
    }

    throw new Error(`Mensaje recibido en un tema MQTT no reconocido: "${topic}"`);
}
