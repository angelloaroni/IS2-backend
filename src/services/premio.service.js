import sequelize from '../config/db.js';
import AppError from '../utils/AppError.js';
import Premio from '../models/Premio.js';
import UsuarioPremio from '../models/UsuarioPremio.js';
import PremioRepository from '../repositories/premio.repository.js';
import eventoRepository from '../repositories/evento.repository.js';
import eventos, { EVENTOS } from '../utils/eventos.js';
import { fechaActualLima } from '../utils/periodo.js';

const premioRepository = new PremioRepository();

export async function obtenerPremios() {
    const premios = await premioRepository.listar();
    return premios.map((premio) => premio.toJSON());
}

function validarDatosPremio(data, parcial = false) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new AppError('Los datos del premio no son válidos', 400);
    }
    const camposDesconocidos = Object.keys(data)
        .filter((campo) => !['nombre', 'descripcion', 'costo', 'stock'].includes(campo));
    if (camposDesconocidos.length > 0) {
        throw new AppError(`Campos no permitidos: ${camposDesconocidos.join(', ')}`, 400);
    }
    const cambios = {};
    for (const campo of ['nombre', 'descripcion']) {
        if (parcial && !Object.hasOwn(data, campo)) continue;
        const texto = typeof data[campo] === 'string' ? data[campo].trim() : '';
        if (!texto) throw new AppError(`El campo ${campo} debe contener texto`, 400);
        cambios[campo] = texto;
    }
    for (const campo of ['costo', 'stock']) {
        if (parcial && !Object.hasOwn(data, campo)) continue;
        const valor = data[campo];
        const numero = (typeof valor === 'number'
            || (typeof valor === 'string' && valor.trim() !== '')) ? Number(valor) : Number.NaN;
        if (campo === 'costo' && (!Number.isFinite(numero) || numero <= 0)) {
            throw new AppError('El costo debe ser mayor a cero', 400);
        }
        if (campo === 'stock' && (!Number.isSafeInteger(numero) || numero < 0)) {
            throw new AppError('El stock debe ser un entero mayor o igual a cero', 400);
        }
        cambios[campo] = numero;
    }
    if (Object.keys(cambios).length === 0) {
        throw new AppError('Debe enviar al menos un campo para actualizar', 400);
    }
    return cambios;
}

function validarIdPremio(id) {
    const numero = Number(id);
    if (!/^[1-9]\d*$/.test(String(id)) || !Number.isSafeInteger(numero)) {
        throw new AppError('El id del premio debe ser un entero positivo', 400);
    }
    return numero;
}

export async function editarPremio(id, data) {
    const idPremio = validarIdPremio(id);
    const cambios = validarDatosPremio(data, true);
    return sequelize.transaction(async (transaction) => {
        const premio = await premioRepository.bloquearPremio(idPremio, transaction);
        if (!premio) throw new AppError('Premio no encontrado', 404);
        await premio.update(cambios, { transaction });
        return premio.toJSON();
    });
}

export async function eliminarPremio(id) {
    const idPremio = validarIdPremio(id);
    return sequelize.transaction(async (transaction) => {
        const premio = await premioRepository.bloquearPremio(idPremio, transaction);
        if (!premio) throw new AppError('Premio no encontrado', 404);
        await premio.update({ estado: false }, { transaction });
    });
}

export async function agregarPremio(data = {}) {
    const { nombre, descripcion, costo, stock } = validarDatosPremio(data);

    const premioJSON = await sequelize.transaction(async (transaction) => {
        const idPremio = await premioRepository.siguienteId(
            Premio,
            'id_premio',
            'premio',
            transaction
        );
        const premio = await premioRepository.crear({
            id_premio: idPremio,
            nombre,
            descripcion,
            costo,
            stock,
        }, { transaction });
        await eventoRepository.registrar({
            tipo: 'premio.creado',
            referencia: `premio:${premio.id_premio}`,
            payload: {
                idPremio: premio.id_premio,
                nombre: premio.nombre,
            },
        }, { transaction });
        return premio.toJSON();
    });
    eventos.emit(EVENTOS.PREMIO_CREADO, {
        idPremio: premioJSON.id_premio,
        nombre: premioJSON.nombre,
    });
    return premioJSON;
}

export async function canjearPremio(idUser, idPremio) {
    const premioId = Number(idPremio);
    if (!Number.isSafeInteger(premioId) || premioId <= 0) {
        throw new AppError('El id del premio debe ser un entero positivo', 400);
    }

    const resultado = await sequelize.transaction(async (transaction) => {
        const idCanje = await premioRepository.siguienteId(
            UsuarioPremio,
            'id_usuario_premio',
            'usuario_premio',
            transaction
        );
        const usuario = await premioRepository.bloquearUsuario(idUser, transaction);
        if (!usuario || usuario.estado !== true) {
            throw new AppError('Usuario no encontrado o inactivo', 401);
        }

        const premio = await premioRepository.bloquearPremio(premioId, transaction);
        if (!premio) throw new AppError('Premio no encontrado', 404);
        if (premio.stock <= 0) throw new AppError('El premio no tiene stock disponible', 409);
        if (Number(usuario.puntos) < Number(premio.costo)) {
            throw new AppError('No tienes suficientes puntos para canjear este premio', 400);
        }

        await usuario.decrement('puntos', {
            by: Number(premio.costo),
            transaction,
        });
        await premio.decrement('stock', { by: 1, transaction });

        const fechaObtencion = fechaActualLima();
        const canje = await premioRepository.crearCanje({
            id_usuario_premio: idCanje,
            fecha_obtencion: fechaObtencion,
            id_premio: premio.id_premio,
            id_user: usuario.id_user,
        }, transaction);
        await eventoRepository.registrar({
            tipo: 'premio.canjeado',
            referencia: `canje:${idCanje}`,
            payload: {
                idUser: usuario.id_user,
                idPremio: premio.id_premio,
                idCanje,
                nombrePremio: premio.nombre,
            },
        }, { transaction });

        await Promise.all([
            usuario.reload({ transaction }),
            premio.reload({ transaction }),
        ]);
        const resultado = {
            canje: canje.toJSON(),
            premio: {
                id_premio: premio.id_premio,
                nombre: premio.nombre,
                costo: Number(premio.costo),
                stock: Number(premio.stock),
            },
            puntos_restantes: Number(usuario.puntos),
        };
        return resultado;
    });
    eventos.emit(EVENTOS.PREMIO_CANJEADO, {
        idUser: resultado.canje.id_user,
        idPremio: resultado.canje.id_premio,
        idCanje: resultado.canje.id_usuario_premio,
        nombrePremio: resultado.premio.nombre,
    });
    return resultado;
}
