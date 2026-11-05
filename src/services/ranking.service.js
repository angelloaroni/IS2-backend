import AppError from '../utils/AppError.js';
import { normalizarFiltrosPeriodo, obtenerRangoMes } from '../utils/periodo.js';
import {
    listarActividadPorUsuario,
} from './estadisticas.service.js';
import { fechaActualLima } from '../utils/periodo.js';
import RankingRepository from '../repositories/ranking.repository.js';
import configuracionRankingRepository from '../repositories/configuracionRanking.repository.js';

const rankingRepository = new RankingRepository();
const LIMITE_TOP = 10;

function validarConfiguracion(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new AppError('La configuración del ranking no es válida', 400);
    }

    const campos = Object.keys(data);
    const permitidos = ['desde', 'hasta', 'excluidos'];
    const desconocidos = campos.filter((campo) => !permitidos.includes(campo));
    if (desconocidos.length > 0) {
        throw new AppError(`Campos de configuración no permitidos: ${desconocidos.join(', ')}`, 400);
    }
    if (permitidos.some((campo) => !Object.hasOwn(data, campo))) {
        throw new AppError('Debe enviar desde, hasta y excluidos', 400);
    }
    if (!Array.isArray(data.excluidos)) {
        throw new AppError('excluidos debe ser una lista de id_user', 400);
    }

    const excluidos = data.excluidos.map((id) => {
        if (!Number.isSafeInteger(id) || id <= 0) {
            throw new AppError('Cada usuario excluido debe tener un id_user entero positivo', 400);
        }
        return id;
    });
    if (new Set(excluidos).size !== excluidos.length) {
        throw new AppError('La lista de excluidos no puede contener ids repetidos', 400);
    }

    const periodo = normalizarFiltrosPeriodo({ desde: data.desde, hasta: data.hasta });
    return {
        desde: periodo.desde ?? null,
        hasta: periodo.hasta ?? null,
        excluidos,
    };
}

function construirRanking(usuarios, actividad, excluidos) {
    const excluidosSet = new Set(excluidos.map(Number));
    const actividadPorUsuario = new Map(actividad.map((fila) => [
        Number(fila.id_user),
        {
            puntosGanados: Number(fila.puntosGanados),
            cantidadResiduos: Number(fila.cantidadResiduos),
            pesoTotalKg: Number(fila.pesoTotalKg),
        },
    ]));

    return usuarios
        .filter(({ id_user }) => !excluidosSet.has(Number(id_user)))
        .map((usuario) => {
            const datos = actividadPorUsuario.get(Number(usuario.id_user)) ?? {
                puntosGanados: 0,
                cantidadResiduos: 0,
                pesoTotalKg: 0,
            };
            return {
                id_user: Number(usuario.id_user),
                nombre: usuario.nombre,
                puntos: datos.puntosGanados,
                puntosGanados: datos.puntosGanados,
                cantidadResiduos: datos.cantidadResiduos,
                pesoTotalKg: datos.pesoTotalKg,
            };
        })
        .sort((a, b) => b.puntosGanados - a.puntosGanados || a.id_user - b.id_user)
        .map((usuario, indice) => ({ ...usuario, posicion: indice + 1 }));
}

async function calcularRanking(filtros, excluidos) {
    const [usuarios, actividad] = await Promise.all([
        rankingRepository.listarUsuariosElegibles(),
        listarActividadPorUsuario(filtros),
    ]);
    return construirRanking(usuarios, actividad, excluidos);
}

function filtrosEfectivos(solicitados, configuracion) {
    const filtros = {};
    if (Object.hasOwn(solicitados, 'desde')) filtros.desde = solicitados.desde;
    else if (configuracion.desde) filtros.desde = configuracion.desde;
    if (Object.hasOwn(solicitados, 'hasta')) filtros.hasta = solicitados.hasta;
    else if (configuracion.hasta) filtros.hasta = configuracion.hasta;
    return normalizarFiltrosPeriodo(filtros);
}

export async function obtenerConfiguracionRanking() {
    return configuracionRankingRepository.obtener();
}

export async function actualizarConfiguracionRanking(data) {
    const configuracion = validarConfiguracion(data);
    if (!(await rankingRepository.existenUsuariosTipoUsuario(configuracion.excluidos))) {
        throw new AppError('Uno o más usuarios excluidos no existen o no son cuentas de usuario', 400);
    }
    return configuracionRankingRepository.guardar(configuracion);
}

export async function obtenerRanking(idUser, filtrosSolicitados = {}) {
    const solicitados = normalizarFiltrosPeriodo(filtrosSolicitados);
    const configuracion = await configuracionRankingRepository.obtener();
    const filtros = filtrosEfectivos(solicitados, configuracion);
    const usuarios = await calcularRanking(filtros, configuracion.excluidos);
    const posicion = usuarios.findIndex((usuario) => usuario.id_user === Number(idUser));

    return {
        top: usuarios.slice(0, LIMITE_TOP),
        total_usuarios: usuarios.length,
        usuario: posicion === -1 ? null : usuarios[posicion],
        criterio: 'puntos_ganados',
        periodo: {
            desde: filtros.desde ?? null,
            hasta: filtros.hasta ?? null,
        },
    };
}

function obtenerMesActualLima() {
    return fechaActualLima().slice(0, 7);
}

export async function obtenerRecicladorMes(mesSolicitado) {
    const mes = mesSolicitado ?? obtenerMesActualLima();
    const periodo = obtenerRangoMes(mes);
    const configuracion = await configuracionRankingRepository.obtener();
    const usuarios = await calcularRanking(periodo, configuracion.excluidos);
    const ganador = usuarios.find((usuario) => usuario.cantidadResiduos > 0) ?? null;

    return {
        mes,
        criterio: 'puntos_ganados',
        ganador,
    };
}

export async function actualizarRanking(idUser) {
    const ranking = await obtenerRanking(idUser);
    return ranking.usuario;
}
