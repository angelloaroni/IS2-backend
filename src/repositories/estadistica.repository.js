import sequelize from '../config/db.js';
import { QueryTypes, Transaction } from 'sequelize';
import AppError from '../utils/AppError.js';

// 'fecha' proviene del DATE legado; los instantes nuevos se convierten a Lima.
const dia = "COALESCE((a.fecha_instante AT TIME ZONE 'America/Lima')::date, a.fecha)";

export function condicionesActividad(filtros = {}, idUser) {
    const clausulas = [];
    const replacements = {};
    if (idUser !== undefined) { clausulas.push('a.id_user = :idUser'); replacements.idUser = idUser; }
    if (filtros.desde) { clausulas.push(`${dia} >= CAST(:desde AS date)`); replacements.desde = filtros.desde; }
    if (filtros.hasta) { clausulas.push(`${dia} < CAST(:hasta AS date)`); replacements.hasta = filtros.hasta; }
    if (filtros.material) { clausulas.push('a.tipo = :material'); replacements.material = filtros.material; }
    return { where: clausulas.length ? `WHERE ${clausulas.join(' AND ')}` : '', replacements };
}

class EstadisticaRepository {
    async leerConsistente(idUser, operacion) {
        return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ, readOnly: true }, async (transaction) => {
            const consulta = (sql, replacements = {}) => sequelize.query(sql, { replacements, transaction, type: QueryTypes.SELECT });
            if (idUser !== undefined) {
                const cuentas = await consulta('SELECT id_user FROM usuario WHERE id_user = :idUser', { idUser });
                if (!cuentas.length) throw new AppError('Esta cuenta no existe', 404);
            }
            const errores = await consulta(`SELECT 1 FROM actividad_reciclaje
                WHERE NOT consistente ${idUser === undefined ? '' : 'AND id_user = :idUser'} LIMIT 1`, idUser === undefined ? {} : { idUser });
            if (errores.length) throw new AppError('Hay actividades con historial contradictorio o datos inválidos', 409);
            return operacion(consulta);
        });
    }

    async estadisticasUsuario(idUser, filtros) {
        const { where, replacements } = condicionesActividad(filtros, idUser);
        return this.leerConsistente(idUser, async (consulta) => {
            const [fila] = await consulta(`SELECT COUNT(*) AS cantidad_residuos,
                COALESCE(SUM(a.peso),0) AS peso_total_kg,
                COALESCE(SUM(a.puntos_ganados),0) AS puntos_acumulados
                FROM actividad_reciclaje a ${where}`, replacements);
            return Object.fromEntries(Object.entries(fila).map(([campo, valor]) => [campo, Number(valor)]));
        });
    }

    async listarActividad(filtros) {
        const { where, replacements } = condicionesActividad(filtros);
        return this.leerConsistente(undefined, async (consulta) => {
            const filas = await consulta(`SELECT a.id_user, SUM(a.puntos_ganados) AS "puntosGanados",
                COUNT(*) AS "cantidadResiduos", SUM(a.peso) AS "pesoTotalKg"
                FROM actividad_reciclaje a ${where} GROUP BY a.id_user ORDER BY a.id_user`, replacements);
            return filas.map((fila) => Object.fromEntries(Object.entries(fila).map(([campo, valor]) => [campo, Number(valor)])));
        });
    }

    async metricas(filtros, idUser) {
        const { where, replacements } = condicionesActividad(filtros, idUser);
        return this.leerConsistente(idUser, async (consulta) => {
            const base = `FROM actividad_reciclaje a ${where}`;
            const [totales] = await consulta(`SELECT COUNT(*) AS "totalResiduos", COALESCE(SUM(a.peso),0) AS "pesoTotalKg" ${base}`, replacements);
            const porTipo = await consulta(`SELECT a.tipo, COUNT(*) AS cantidad, SUM(a.peso) AS "pesoKg" ${base} GROUP BY a.tipo ORDER BY a.tipo`, replacements);
            const periodo = `TO_CHAR(${dia}, 'YYYY-MM')`;
            const porPeriodo = await consulta(`SELECT ${periodo} AS periodo, COUNT(*) AS "totalResiduos", SUM(a.peso) AS "pesoTotalKg" ${base} GROUP BY ${periodo} ORDER BY ${periodo}`, replacements);
            const porTipoYPeriodo = await consulta(`SELECT ${periodo} AS periodo, a.tipo, COUNT(*) AS cantidad, SUM(a.peso) AS "pesoKg" ${base} GROUP BY ${periodo}, a.tipo ORDER BY ${periodo}, a.tipo`, replacements);
            const numerica = (fila) => Object.fromEntries(Object.entries(fila).map(([campo, valor]) => [campo, ['tipo', 'periodo'].includes(campo) ? valor : Number(valor)]));
            return { ...numerica(totales), porTipo: porTipo.map(numerica), porPeriodo: porPeriodo.map(numerica), porTipoYPeriodo: porTipoYPeriodo.map(numerica) };
        });
    }

    async participacion(filtros) {
        const { where, replacements } = condicionesActividad(filtros);
        const elegibles = "u.tipo = 'usuario' AND u.estado = TRUE";
        return this.leerConsistente(undefined, async (consulta) => {
            const [cuentas] = await consulta(`SELECT COUNT(*) AS n FROM usuario u WHERE ${elegibles}`);
            const base = `FROM actividad_reciclaje a JOIN usuario u ON u.id_user = a.id_user ${where} ${where ? 'AND' : 'WHERE'} ${elegibles}`;
            const [total] = await consulta(`SELECT COUNT(DISTINCT a.id_user) AS n ${base}`, replacements);
            const periodo = `TO_CHAR(${dia}, 'YYYY-MM')`;
            const filas = await consulta(`SELECT ${periodo} AS periodo, COUNT(DISTINCT a.id_user) AS n ${base} GROUP BY ${periodo} ORDER BY ${periodo}`, replacements);
            const denominador = Number(cuentas.n);
            const indicadores = (n) => ({ participantes: Number(n), denominador, tasaPorcentaje: denominador ? 100 * Number(n) / denominador : null });
            return { ...indicadores(total.n), porPeriodo: filas.map((fila) => ({ periodo: fila.periodo, ...indicadores(fila.n) })) };
        });
    }
}
export default new EstadisticaRepository();
