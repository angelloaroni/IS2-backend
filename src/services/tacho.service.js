import sequelize from '../config/db.js';
import AppError from '../utils/AppError.js';
import tachoRepository from '../repositories/tacho.repository.js';

const RADIO_TERRESTRE_METROS = 6371000;
const RADIO_MAXIMO_METROS = 50000;
const RADIO_PREDETERMINADO_METROS = 5000;

function convertirNumero(valor) {
    if (
        (typeof valor !== 'number' && typeof valor !== 'string')
        || (typeof valor === 'string' && valor.trim() === '')
    ) {
        return Number.NaN;
    }
    return Number(valor);
}

function validarCoordenadas(latitud, longitud) {
    const latitudNumero = convertirNumero(latitud);
    const longitudNumero = convertirNumero(longitud);

    if (!Number.isFinite(latitudNumero) || latitudNumero < -90 || latitudNumero > 90) {
        throw new AppError('La latitud debe estar entre -90 y 90', 400);
    }
    if (!Number.isFinite(longitudNumero) || longitudNumero < -180 || longitudNumero > 180) {
        throw new AppError('La longitud debe estar entre -180 y 180', 400);
    }

    return { latitud: latitudNumero, longitud: longitudNumero };
}

function validarCapacidad(capacidad) {
    if (typeof capacidad !== 'boolean') {
        throw new AppError('La capacidad debe ser un valor booleano', 400);
    }
    return capacidad;
}

function validarTipo(tipo) {
    if (typeof tipo !== 'string' || !tipo.trim() || tipo.trim().length > 32) {
        throw new AppError('El tipo de tacho debe contener entre 1 y 32 caracteres', 400);
    }
    return tipo.trim();
}

function validarPorcentaje(porcentaje) {
    const porcentajeNumero = convertirNumero(porcentaje);
    if (!Number.isFinite(porcentajeNumero) || porcentajeNumero < 0 || porcentajeNumero > 100) {
        throw new AppError('El porcentaje debe ser un número entre 0 y 100', 400);
    }
    return porcentajeNumero;
}

function validarDatos(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new AppError('Los datos del tacho no son válidos', 400);
    }
    if (Object.keys(data).some((key) => !['tipo', 'latitud', 'longitud', 'capacidad', 'porcentaje'].includes(key))) {
        throw new AppError('Los datos incluyen campos no permitidos', 400);
    }
}

function serializarTacho(tacho) {
    return {
        idTacho: tacho.id_tacho,
        tipo: tacho.tipo ?? null,
        latitud: tacho.latitud,
        longitud: tacho.longitud,
        capacidad: tacho.capacidad,
        porcentaje: tacho.porcentaje ?? null,
    };
}

function distanciaMetros(origen, destino) {
    const radianes = (grados) => grados * Math.PI / 180;
    const diferenciaLatitud = radianes(destino.latitud - origen.latitud);
    const diferenciaLongitud = radianes(destino.longitud - origen.longitud);
    const latitudOrigen = radianes(origen.latitud);
    const latitudDestino = radianes(destino.latitud);
    const a = Math.sin(diferenciaLatitud / 2) ** 2
        + Math.cos(latitudOrigen) * Math.cos(latitudDestino)
        * Math.sin(diferenciaLongitud / 2) ** 2;

    return 2 * RADIO_TERRESTRE_METROS * Math.asin(Math.sqrt(Math.min(1, a)));
}

export async function obtenerTachosCercanos({ lat, lng, radio } = {}) {
    const { latitud, longitud } = validarCoordenadas(lat, lng);
    const radioMetros = radio === undefined
        ? RADIO_PREDETERMINADO_METROS
        : convertirNumero(radio);

    if (!Number.isFinite(radioMetros) || radioMetros <= 0 || radioMetros > RADIO_MAXIMO_METROS) {
        throw new AppError(`El radio debe ser mayor a 0 y no superar ${RADIO_MAXIMO_METROS} metros`, 400);
    }

    const distanciaAngular = radioMetros / RADIO_TERRESTRE_METROS;
    const deltaLatitud = distanciaAngular * 180 / Math.PI;
    const latitudMinima = Math.max(-90, latitud - deltaLatitud);
    const latitudMaxima = Math.min(90, latitud + deltaLatitud);
    const latitudRad = latitud * Math.PI / 180;
    const razonLongitud = Math.sin(distanciaAngular) / Math.cos(latitudRad);
    let rangoLongitud;

    if (Math.abs(razonLongitud) < 1) {
        const deltaLongitud = Math.asin(Math.abs(razonLongitud)) * 180 / Math.PI;
        const minima = longitud - deltaLongitud;
        const maxima = longitud + deltaLongitud;

        if (minima < -180) {
            rangoLongitud = {
                cruzaAntimeridiano: true,
                minimaEnvuelta: minima + 360,
                maximaEnvuelta: maxima,
            };
        } else if (maxima > 180) {
            rangoLongitud = {
                cruzaAntimeridiano: true,
                minimaEnvuelta: minima,
                maximaEnvuelta: maxima - 360,
            };
        } else {
            rangoLongitud = { minima, maxima };
        }
    }

    const candidatos = await tachoRepository.buscarActivosEnRectangulo({
        latitudMinima,
        latitudMaxima,
        longitud: rangoLongitud,
    });

    return candidatos
        .map((tacho) => {
            const distanciaExacta = distanciaMetros(
                { latitud, longitud },
                { latitud: Number(tacho.latitud), longitud: Number(tacho.longitud) }
            );
            return {
                ...serializarTacho(tacho),
                distanciaExacta,
                distanciaM: Math.round(distanciaExacta),
            };
        })
        .filter((tacho) => tacho.distanciaExacta <= radioMetros)
        .sort((a, b) => a.distanciaExacta - b.distanciaExacta)
        .map(({ distanciaExacta, ...tacho }) => tacho);
}

export async function obtenerTachos() {
    const tachos = await tachoRepository.listarActivos();
    return tachos.map(serializarTacho);
}

export async function obtenerTacho(id) {
    const idTacho = Number(id);
    if (!Number.isInteger(idTacho) || idTacho <= 0) {
        throw new AppError('El id del tacho no es válido', 400);
    }
    return serializarTacho(await tachoRepository.buscarActivoPorId(idTacho));
}

export async function actualizarEstadoTacho(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new AppError('El estado del tacho no es válido', 400);
    }
    const idCampo = Object.hasOwn(data, 'id_tacho') ? 'id_tacho' : 'idTacho';
    const camposPermitidos = idCampo === 'id_tacho'
        ? ['id_tacho', 'tipo', 'latitud', 'longitud', 'capacidad', 'porcentaje']
        : ['idTacho', 'tipo', 'latitud', 'longitud', 'capacidad', 'porcentaje'];
    if (Object.keys(data).some((key) => !camposPermitidos.includes(key))) {
        throw new AppError('El estado del tacho contiene campos no permitidos', 400);
    }
    const camposRequeridos = idCampo === 'id_tacho'
        ? ['id_tacho', 'tipo', 'latitud', 'longitud', 'capacidad', 'porcentaje']
        : ['idTacho', 'latitud', 'longitud', 'capacidad'];
    if (camposRequeridos.some((key) => data[key] === undefined)) {
        throw new AppError('El estado debe incluir todos los campos requeridos del formato MQTT', 400);
    }

    const idTacho = Number(data[idCampo]);
    if (!Number.isInteger(idTacho) || idTacho <= 0) {
        throw new AppError('El id del tacho no es válido', 400);
    }
    const coordenadas = validarCoordenadas(data.latitud, data.longitud);
    const capacidad = validarCapacidad(data.capacidad);
    const cambios = { ...coordenadas, capacidad };
    if (data.tipo !== undefined) {
        cambios.tipo = validarTipo(data.tipo);
    }
    if (data.porcentaje !== undefined) {
        cambios.porcentaje = validarPorcentaje(data.porcentaje);
    }
    return serializarTacho(await tachoRepository.actualizar(idTacho, cambios));
}

export async function agregarTacho(data) {
    validarDatos(data);
    const coordenadas = validarCoordenadas(data.latitud, data.longitud);
    const capacidad = validarCapacidad(data.capacidad);
    const tipo = data.tipo === undefined ? null : validarTipo(data.tipo);
    const porcentaje = data.porcentaje === undefined ? null : validarPorcentaje(data.porcentaje);
    const transaction = await sequelize.transaction();

    try {
        const tacho = await tachoRepository.crear(
            { tipo, ...coordenadas, capacidad, porcentaje },
            { transaction }
        );
        await transaction.commit();
        return serializarTacho(tacho);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

export async function editarTacho(id, data) {
    validarDatos(data);
    const idTacho = Number(id);
    if (!Number.isInteger(idTacho) || idTacho <= 0) {
        throw new AppError('El id del tacho no es válido', 400);
    }

    const cambios = {};
    if (data.latitud !== undefined || data.longitud !== undefined) {
        const tachoActual = await tachoRepository.buscarActivoPorId(idTacho);
        Object.assign(cambios, validarCoordenadas(
            data.latitud !== undefined ? data.latitud : tachoActual.latitud,
            data.longitud !== undefined ? data.longitud : tachoActual.longitud
        ));
    }
    if (data.capacidad !== undefined) {
        cambios.capacidad = validarCapacidad(data.capacidad);
    }
    if (data.tipo !== undefined) {
        cambios.tipo = validarTipo(data.tipo);
    }
    if (data.porcentaje !== undefined) {
        cambios.porcentaje = validarPorcentaje(data.porcentaje);
    }
    if (Object.keys(cambios).length === 0) {
        throw new AppError('Debe enviar al menos un campo para actualizar', 400);
    }

    return serializarTacho(await tachoRepository.actualizar(idTacho, cambios));
}

export async function eliminarTacho(id) {
    const idTacho = Number(id);
    if (!Number.isInteger(idTacho) || idTacho <= 0) {
        throw new AppError('El id del tacho no es válido', 400);
    }
    return tachoRepository.darDeBaja(idTacho);
}