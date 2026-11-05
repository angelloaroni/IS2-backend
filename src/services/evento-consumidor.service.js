import sequelize from '../config/db.js';
import eventoRepository from '../repositories/evento.repository.js';
import { evaluarLogros } from './logro.service.js';
import { procesarEventoNotificacion } from './notificacion.service.js';
import eventos, { EVENTOS } from '../utils/eventos.js';

export async function procesarSiguienteEvento() {
    let seleccionado = null;
    try {
        const entregado = await sequelize.transaction(async (transaction) => {
            seleccionado = await eventoRepository.obtenerSiguiente(transaction);
            if (!seleccionado) return null;

            if (seleccionado.consumidor === 'logros') {
                if (seleccionado.tipo !== EVENTOS.RESIDUO_REGISTRADO) {
                    throw new Error(`El consumidor logros no admite ${seleccionado.tipo}`);
                }
                await evaluarLogros(seleccionado.payload.idUser, { transaction });
            } else if (seleccionado.consumidor === 'notificaciones') {
                await procesarEventoNotificacion(
                    seleccionado.tipo,
                    seleccionado.payload,
                    { transaction }
                );
            } else {
                throw new Error(`Consumidor desconocido: ${seleccionado.consumidor}`);
            }

            await eventoRepository.marcarEntregado(seleccionado, transaction);
            return seleccionado;
        });

        if (!entregado) return false;
        if (
            entregado.tipo === EVENTOS.LOGRO_OTORGADO
            && entregado.consumidor === 'notificaciones'
        ) {
            eventos.emit(EVENTOS.LOGRO_OTORGADO, entregado.payload);
        }
        return true;
    } catch (error) {
        if (!seleccionado) throw error;
        await eventoRepository.registrarFallo(seleccionado, error);
        console.error(
            `Error procesando ${seleccionado.tipo} (${seleccionado.consumidor}); se reintentará:`,
            error
        );
        return true;
    }
}

let procesadorActivo = false;
let temporizador;

async function procesarCola() {
    if (procesadorActivo) return;
    procesadorActivo = true;
    try {
        let hayPendientes;
        do {
            hayPendientes = await procesarSiguienteEvento();
        } while (hayPendientes);
    } catch (error) {
        console.error('Error consultando la cola de eventos pendientes:', error);
    } finally {
        procesadorActivo = false;
        temporizador = setTimeout(procesarCola, 1_000);
        temporizador.unref();
    }
}

export function iniciarProcesadorEventos() {
    if (temporizador || procesadorActivo) return;
    void procesarCola();
}
