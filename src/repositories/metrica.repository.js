import sequelize from '../config/db.js';
import { QueryTypes } from 'sequelize';
import Usuario from '../models/Usuario.js';
import AppError from '../utils/AppError.js';

async function validarHistorialUnivoco() {
    const filas = await sequelize.query(
        `SELECT r.id_residuo
         FROM residuo r
         INNER JOIN historialreciclaje h ON h.id_residuo = r.id_residuo
         GROUP BY r.id_residuo
         HAVING COUNT(DISTINCT h.fecha) > 1
            OR BOOL_OR(h.id_user <> r.id_user)
         LIMIT 1`,
        { type: QueryTypes.SELECT }
    );
    if (filas.length > 0) {
        throw new AppError(
            'No se pueden calcular estadísticas: existe actividad histórica ambigua',
            500
        );
    }
}

const ACTIVIDAD_CTE = `WITH actividad AS (
    SELECT r.id_residuo, r.id_user, r.peso, MIN(h.fecha) AS fecha
    FROM residuo r
    INNER JOIN historialreciclaje h
        ON h.id_residuo = r.id_residuo AND h.id_user = r.id_user
    GROUP BY r.id_residuo, r.id_user, r.peso
)`;

const FILTROS_ACTIVIDAD = `
    (:desde IS NULL OR a.fecha >= CAST(:desde AS DATE))
    AND (:hasta IS NULL OR a.fecha < CAST(:hasta AS DATE))`;

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

    async obtenerEstadisticasUsuario(idUser, filtros = {}) {
        const usuario = await Usuario.findByPk(idUser, { attributes: ['id_user'] });
        if (!usuario) throw new AppError('Esta cuenta no existe', 404);
        await validarHistorialUnivoco();

        const [totales] = await sequelize.query(
            `${ACTIVIDAD_CTE}
             SELECT COUNT(*) AS cantidad_residuos,
                    COALESCE(SUM(a.peso), 0) AS peso_total_kg,
                    COALESCE(SUM(a.peso * 10), 0) AS puntos_acumulados
             FROM actividad a
             WHERE a.id_user = :idUser AND ${FILTROS_ACTIVIDAD}`,
            {
                replacements: { idUser, desde: filtros.desde ?? null, hasta: filtros.hasta ?? null },
                type: QueryTypes.SELECT,
            }
        );

        return {
            cantidad_residuos: Number(totales.cantidad_residuos),
            peso_total_kg: Number(totales.peso_total_kg),
            puntos_acumulados: Number(totales.puntos_acumulados),
        };
    }

    async listarActividadPorUsuario(filtros = {}) {
        await validarHistorialUnivoco();
        const filas = await sequelize.query(
            `${ACTIVIDAD_CTE}
             SELECT a.id_user,
                    COALESCE(SUM(a.peso * 10), 0) AS "puntosGanados",
                    COUNT(*) AS "cantidadResiduos",
                    COALESCE(SUM(a.peso), 0) AS "pesoTotalKg"
             FROM actividad a
             WHERE ${FILTROS_ACTIVIDAD}
             GROUP BY a.id_user
             ORDER BY a.id_user`,
            {
                replacements: { desde: filtros.desde ?? null, hasta: filtros.hasta ?? null },
                type: QueryTypes.SELECT,
            }
        );
        return filas.map((fila) => ({
            id_user: Number(fila.id_user),
            puntosGanados: Number(fila.puntosGanados),
            cantidadResiduos: Number(fila.cantidadResiduos),
            pesoTotalKg: Number(fila.pesoTotalKg),
        }));
    }
}

export default new MetricaRepository();