import sequelize from '../config/db.js';
import AppError from '../utils/AppError.js';
import Premio from '../models/Premio.js';
import UsuarioPremio from '../models/UsuarioPremio.js';
import PremioRepository from '../repositories/premio.repository.js';
import eventos, { EVENTOS } from '../utils/eventos.js';

const premioRepository = new PremioRepository();

export async function obtenerPremios() {
    const premios = await premioRepository.listar();
    return premios.map((premio) => premio.toJSON());
}

export async function agregarPremio(data = {}) {
    const nombre = String(data.nombre ?? '').trim();
    const descripcion = String(data.descripcion ?? '').trim();
    const costo = Number(data.costo);
    const stock = Number(data.stock);

    if (!nombre) throw new AppError('El nombre del premio es obligatorio', 400);
    if (!descripcion) throw new AppError('La descripción del premio es obligatoria', 400);
    if (!Number.isFinite(costo) || costo <= 0) {
        throw new AppError('El costo debe ser mayor a cero', 400);
    }
    if (!Number.isSafeInteger(stock) || stock < 0) {
        throw new AppError('El stock debe ser un entero mayor o igual a cero', 400);
    }

    const transaction = await sequelize.transaction();
    try {
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
        await transaction.commit();
        return premio.toJSON();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

export async function canjearPremio(idUser, idPremio) {
    const premioId = Number(idPremio);
    if (!Number.isSafeInteger(premioId) || premioId <= 0) {
        throw new AppError('El id del premio debe ser un entero positivo', 400);
    }

    const transaction = await sequelize.transaction();
    try {
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

        const fechaObtencion = new Date().toISOString().slice(0, 10);
        const canje = await premioRepository.crearCanje({
            id_usuario_premio: idCanje,
            fecha_obtencion: fechaObtencion,
            id_premio: premio.id_premio,
            id_user: usuario.id_user,
        }, transaction);

        await transaction.commit();
        const resultado = {
            canje: canje.toJSON(),
            premio: {
                id_premio: premio.id_premio,
                nombre: premio.nombre,
                costo: Number(premio.costo),
                stock: Number(premio.stock) - 1,
            },
            puntos_restantes: Number(usuario.puntos) - Number(premio.costo),
        };
        eventos.emit(EVENTOS.PREMIO_CANJEADO, {
            idUser: usuario.id_user,
            idPremio: premio.id_premio,
            nombrePremio: premio.nombre,
        });
        return resultado;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
