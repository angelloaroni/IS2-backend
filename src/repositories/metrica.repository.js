import sequelize from '../config/db.js';
import { QueryTypes } from 'sequelize';

class MetricaRepository {
    async obtenerPorUsuario(idUser) {
        const [totales, porTipo, porPeriodo, porTipoYPeriodo] = await Promise.all([
            sequelize.query(
                `SELECT COUNT(DISTINCT r.id_residuo) AS "totalResiduos",
                        COALESCE(SUM(r.peso), 0) AS "pesoTotalKg"
                 FROM historialreciclaje h
                 INNER JOIN residuo r ON r.id_residuo = h.id_residuo
                 WHERE h.id_user = :idUser`,
                {
                    replacements: { idUser },
                    type: QueryTypes.SELECT,
                }
            ),
            sequelize.query(
                `SELECT r.tipo AS "tipo",
                        COUNT(DISTINCT r.id_residuo) AS "cantidad",
                        COALESCE(SUM(r.peso), 0) AS "pesoKg"
                 FROM historialreciclaje h
                 INNER JOIN residuo r ON r.id_residuo = h.id_residuo
                 WHERE h.id_user = :idUser
                 GROUP BY r.tipo
                 ORDER BY r.tipo`,
                {
                    replacements: { idUser },
                    type: QueryTypes.SELECT,
                }
            ),
            sequelize.query(
                `SELECT TO_CHAR(DATE_TRUNC('month', h.fecha), 'YYYY-MM') AS "periodo",
                        COUNT(DISTINCT r.id_residuo) AS "totalResiduos",
                        COALESCE(SUM(r.peso), 0) AS "pesoTotalKg"
                 FROM historialreciclaje h
                 INNER JOIN residuo r ON r.id_residuo = h.id_residuo
                 WHERE h.id_user = :idUser
                 GROUP BY DATE_TRUNC('month', h.fecha)
                 ORDER BY DATE_TRUNC('month', h.fecha)`,
                {
                    replacements: { idUser },
                    type: QueryTypes.SELECT,
                }
            ),
            sequelize.query(
                `SELECT TO_CHAR(DATE_TRUNC('month', h.fecha), 'YYYY-MM') AS "periodo",
                        r.tipo AS "tipo",
                        COUNT(DISTINCT r.id_residuo) AS "cantidad",
                        COALESCE(SUM(r.peso), 0) AS "pesoKg"
                 FROM historialreciclaje h
                 INNER JOIN residuo r ON r.id_residuo = h.id_residuo
                 WHERE h.id_user = :idUser
                 GROUP BY DATE_TRUNC('month', h.fecha), r.tipo
                 ORDER BY DATE_TRUNC('month', h.fecha), r.tipo`,
                {
                    replacements: { idUser },
                    type: QueryTypes.SELECT,
                }
            ),
        ]);

        return {
            totalResiduos: Number(totales[0].totalResiduos),
            pesoTotalKg: Number(totales[0].pesoTotalKg),
            porTipo: porTipo.map((fila) => ({
                tipo: fila.tipo,
                cantidad: Number(fila.cantidad),
                pesoKg: Number(fila.pesoKg),
            })),
            porPeriodo: porPeriodo.map((fila) => ({
                periodo: fila.periodo,
                totalResiduos: Number(fila.totalResiduos),
                pesoTotalKg: Number(fila.pesoTotalKg),
            })),
            porTipoYPeriodo: porTipoYPeriodo.map((fila) => ({
                periodo: fila.periodo,
                tipo: fila.tipo,
                cantidad: Number(fila.cantidad),
                pesoKg: Number(fila.pesoKg),
            })),
        };
    }
}

export default new MetricaRepository();