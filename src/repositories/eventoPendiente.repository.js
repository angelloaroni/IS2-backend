import sequelize from '../config/db.js';
import { QueryTypes } from 'sequelize';

class EventoPendienteRepository {
    async registrarReciclaje(payload, { transaction }) {
        if (!transaction) throw new Error('El evento pendiente requiere la transacción de la actividad');
        const filas = await sequelize.query(`INSERT INTO evento_pendiente(nombre, referencia, payload)
            VALUES ('residuo.registrado', :referencia, CAST(:payload AS jsonb)) RETURNING id_evento`, {
            replacements: { referencia: String(payload.idResiduo), payload: JSON.stringify(payload) },
            transaction, type: QueryTypes.SELECT,
        });
        return filas[0].id_evento;
    }
}
export default new EventoPendienteRepository();
