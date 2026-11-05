/**
 * Firmas del PDF, página 8, y acuerdos aprobados por el usuario.
 * Solo tipos para pruebas; sin servicios reales, endpoints ni migraciones.
 * Cuenta inexistente: AppError('Esta cuenta no existe', 404).
 * @typedef {Object} FiltrosActividad
 * @property {string} [desde] YYYY-MM-DD, día de Lima incluido; omitido: sin límite inicial.
 * @property {string} [hasta] YYYY-MM-DD, día de Lima excluido; omitido: sin límite final.
 */

/**
 * @typedef {Object} EstadisticasUsuario
 * @property {number} cantidad_residuos
 * @property {number} peso_total_kg Kilogramos.
 * @property {number} puntos_acumulados Total ganado; independiente del saldo canjeable.
 */

/**
 * @typedef {Object} ActividadUsuario
 * @property {number} id_user
 * @property {number} puntosGanados
 * @property {number} cantidadResiduos
 * @property {number} pesoTotalKg
 */

/**
 * @typedef {Object} ProveedorEstadisticas
 * @property {function(number, FiltrosActividad=): Promise<EstadisticasUsuario>} obtenerEstadisticasUsuario
 * @property {function(FiltrosActividad=): Promise<ActividadUsuario[]>} listarActividadPorUsuario
 */

/**
 * Payload existente R1; se emite después del commit, no simular su persistencia.
 * @typedef {Object} ResiduoRegistrado
 * @property {number} idUser
 * @property {number} idResiduo
 * @property {number} idTacho
 * @property {string} tipo
 * @property {number} peso Kilogramos.
 * @property {number} puntosGanados
 * @property {Date} fecha Fecha de servidor.
 */

export {};
