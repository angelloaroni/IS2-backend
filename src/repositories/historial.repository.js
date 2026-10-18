import HistorialReciclaje from '../models/HistorialReciclaje.js';
import sequelize from '../config/db.js';
import { QueryTypes } from 'sequelize';

class HistorialRepository {
    async crear(data, { transaction }) {
        await sequelize.query(
            'LOCK TABLE "historialreciclaje" IN EXCLUSIVE MODE',
            { transaction }
        );
        const ultimoId = await HistorialReciclaje.max('id_historial', { transaction });
        return HistorialReciclaje.create({
            ...data,
            id_historial: Number(ultimoId ?? 0) + 1,
        }, { transaction });
    }

    async obtenerPorUsuario(idUser, { limit, offset }) {
        const [filas, conteo] = await Promise.all([
            sequelize.query(
                `SELECT h.id_historial AS "idHistorial",
                        h.fecha AS "fecha",
                        h.id_tacho AS "idTacho",
                        r.tipo AS "tipo",
                        r.peso AS "peso"
                 FROM historialreciclaje h
                 INNER JOIN residuo r ON r.id_residuo = h.id_residuo
                 WHERE h.id_user = :idUser
                 ORDER BY h.fecha DESC, h.id_historial DESC
                 LIMIT :limit OFFSET :offset`,
                {
                    replacements: { idUser, limit, offset },
                    type: QueryTypes.SELECT,
                }
            ),
            sequelize.query(
                `SELECT COUNT(*) AS "total"
                 FROM historialreciclaje
                 WHERE id_user = :idUser`,
                {
                    replacements: { idUser },
                    type: QueryTypes.SELECT,
                }
            ),
        ]);

        return {
            registros: filas.map((fila) => ({
                idHistorial: Number(fila.idHistorial),
                fecha: fila.fecha,
                idTacho: Number(fila.idTacho),
                residuo: {
                    tipo: fila.tipo,
                    peso: Number(fila.peso),
                },
            })),
            total: Number(conteo[0].total),
        };
    }
}

export default new HistorialRepository();