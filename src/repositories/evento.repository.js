import { QueryTypes } from 'sequelize';
import sequelize from '../config/db.js';
import EventoPendiente from '../models/EventoPendiente.js';
import EntregaEvento from '../models/EntregaEvento.js';

const CONSUMIDORES = {
    'residuo.registrado': ['logros', 'notificaciones'],
    'logro.otorgado': ['notificaciones'],
    'premio.canjeado': ['notificaciones'],
    'usuario.registrado': ['notificaciones'],
    'premio.creado': ['notificaciones'],
};

class EventoRepository {
    async registrar({ tipo, referencia, payload }, { transaction } = {}) {
        if (!transaction) {
            throw new Error('Registrar un evento pendiente requiere la transacción del productor');
        }
        const consumidores = CONSUMIDORES[tipo];
        if (!consumidores) throw new Error(`No hay consumidores definidos para ${tipo}`);

        const [evento, creado] = await EventoPendiente.findOrCreate({
            where: { referencia_evento: referencia },
            defaults: {
                tipo,
                payload,
            },
            transaction,
        });
        if (!creado && (
            evento.tipo !== tipo || JSON.stringify(evento.payload) !== JSON.stringify(payload)
        )) {
            throw new Error(`La referencia ${referencia} ya pertenece a otro evento`);
        }

        await EntregaEvento.bulkCreate(
            consumidores.map((consumidor) => ({
                id_evento: evento.id_evento,
                consumidor,
            })),
            { transaction, ignoreDuplicates: true }
        );
        return evento;
    }

    async obtenerSiguiente(transaction) {
        const [evento] = await sequelize.query(
            `SELECT e.id_evento, e.tipo, e.payload, d.consumidor, d.intentos
             FROM evento_pendiente e
             INNER JOIN entrega_evento d ON d.id_evento = e.id_evento
             WHERE d.entregado_en IS NULL
               AND (d.proximo_intento_en IS NULL OR d.proximo_intento_en <= CURRENT_TIMESTAMP)
             ORDER BY e.id_evento, d.consumidor
             LIMIT 1
             FOR UPDATE OF d SKIP LOCKED`,
            { transaction, type: QueryTypes.SELECT }
        );
        return evento ?? null;
    }

    async marcarEntregado({ id_evento, consumidor }, transaction) {
        const [actualizadas] = await EntregaEvento.update({
            entregado_en: new Date(),
            ultimo_error: null,
            proximo_intento_en: null,
        }, {
            where: { id_evento, consumidor, entregado_en: null },
            transaction,
        });
        if (actualizadas !== 1) {
            throw new Error(`No se pudo confirmar la entrega ${id_evento}/${consumidor}`);
        }
    }

    async registrarFallo({ id_evento, consumidor, intentos }, error) {
        const siguienteIntento = Number(intentos) + 1;
        const esperaMs = Math.min(300_000, 1_000 * (2 ** Math.min(siguienteIntento, 8)));
        const mensaje = String(error?.message ?? error).slice(0, 1000);
        const [actualizadas] = await EntregaEvento.update({
            intentos: siguienteIntento,
            ultimo_error: mensaje,
            proximo_intento_en: new Date(Date.now() + esperaMs),
        }, {
            where: { id_evento, consumidor, entregado_en: null },
        });
        if (actualizadas !== 1) {
            throw new Error(`No se pudo registrar el reintento ${id_evento}/${consumidor}`);
        }
    }
}

export default new EventoRepository();
