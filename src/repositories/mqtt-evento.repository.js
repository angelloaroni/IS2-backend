import sequelize from '../config/db.js';
import { QueryTypes } from 'sequelize';

class MqttEventoRepository {
    async obtenerUltimoEvento(idTacho) {
        const [fila] = await sequelize.query(
            `SELECT last_event
             FROM mqtt_event_sequence
             WHERE id_tacho = :idTacho`,
            {
                replacements: { idTacho },
                type: QueryTypes.SELECT,
            }
        );
        if (!fila) {
            throw new Error(`No existe secuencia MQTT configurada para el tacho ${idTacho}`);
        }
        return Number(fila.last_event);
    }

    async bloquearSecuencia(idTacho, { transaction }) {
        const [fila] = await sequelize.query(
            `SELECT last_event
             FROM mqtt_event_sequence
             WHERE id_tacho = :idTacho
             FOR UPDATE`,
            {
                replacements: { idTacho },
                transaction,
                type: QueryTypes.SELECT,
            }
        );
        if (!fila) {
            throw new Error(`No existe secuencia MQTT configurada para el tacho ${idTacho}`);
        }
        return Number(fila.last_event);
    }

    async actualizarSecuencia(idTacho, numeroEvento, { transaction }) {
        await sequelize.query(
            `UPDATE mqtt_event_sequence
             SET last_event = GREATEST(last_event, :numeroEvento)
             WHERE id_tacho = :idTacho`,
            {
                replacements: { idTacho, numeroEvento },
                transaction,
            }
        );
    }
}

export default new MqttEventoRepository();
