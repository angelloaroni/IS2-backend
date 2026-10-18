import AppError from '../utils/AppError.js';
import historialRepository from '../repositories/historial.repository.js';

function parsearEntero(valor, defecto, nombre) {
    if (valor === undefined) {
        return defecto;
    }
    if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)) {
        throw new AppError(`El parámetro ${nombre} debe ser un entero positivo`, 400);
    }
    const numero = Number(valor);
    if (!Number.isSafeInteger(numero)) {
        throw new AppError(`El parámetro ${nombre} no es válido`, 400);
    }
    return numero;
}

export async function obtenerHistorial(idUser, consulta = {}) {
    const pagina = parsearEntero(consulta.pagina, 1, 'pagina');
    const limite = parsearEntero(consulta.limite, 10, 'limite');

    if (limite > 100) {
        throw new AppError('El límite máximo por página es 100', 400);
    }
    const offset = (pagina - 1) * limite;
    if (!Number.isSafeInteger(offset)) {
        throw new AppError('La página solicitada no es válida', 400);
    }

    const resultado = await historialRepository.obtenerPorUsuario(idUser, {
        limit: limite,
        offset,
    });

    return {
        registros: resultado.registros,
        paginacion: {
            pagina,
            limite,
            total: resultado.total,
            totalPaginas: Math.ceil(resultado.total / limite),
        },
    };
}