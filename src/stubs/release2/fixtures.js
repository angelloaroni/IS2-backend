/**
 * Datos sintéticos compartidos de Fase 0. Sin credenciales ni escritura de BD.
 * Los resultados son expectativas explícitas: no implementan consultas ni ranking.
 * Fechas según acuerdos aprobados; no se modifica la persistencia de R1.
 */
export function crearFixturesRelease2() {
    const residuos = [
        { id_residuo: 42, id_user: 1, id_tacho: 3, tipo: 'plastico', peso: 0.25 },
        { id_residuo: 43, id_user: 1, id_tacho: 3, tipo: 'papel/carton', peso: 0.5 },
        { id_residuo: 44, id_user: 2, id_tacho: 3, tipo: 'vidrio', peso: 1 },
        { id_residuo: 45, id_user: 1, id_tacho: 3, tipo: 'vidrio', peso: 0.25 },
        { id_residuo: 46, id_user: 3, id_tacho: 3, tipo: 'papel/carton', peso: 0.5 },
        { id_residuo: 47, id_user: 4, id_tacho: 3, tipo: 'plastico', peso: 0.25 },
    ];
    const historial = residuos.map((residuo, i) => ({
        id_historial: 100 + i,
        id_user: residuo.id_user,
        id_tacho: residuo.id_tacho,
        id_residuo: residuo.id_residuo,
        fecha: i === 3 ? '2026-02-01' : '2026-01-15',
    }));

    return {
        usuarios: [
            { id_user: 1, cod_user: '00000001', nombre: 'Usuario Uno', tipo: 'usuario', estado: true, puntos: 5 },
            { id_user: 2, cod_user: '00000002', nombre: 'Usuario Dos', tipo: 'usuario', estado: true, puntos: 10 },
            { id_user: 3, cod_user: '00000003', nombre: 'Usuario Inactivo', tipo: 'usuario', estado: false, puntos: 5 },
            { id_user: 4, cod_user: '00000004', nombre: 'Administrador', tipo: 'admin', estado: true, puntos: 2.5 },
            { id_user: 5, cod_user: '00000005', nombre: 'Sin Actividad', tipo: 'usuario', estado: true, puntos: 0 },
        ],
        tachos: [
            { id_tacho: 3, tipo: 'plastico', latitud: -12.0464, longitud: -77.0428, capacidad: false, porcentaje: 25, estado: true },
            { id_tacho: 4, tipo: 'vidrio', latitud: -12.0464, longitud: -77.0428, capacidad: true, porcentaje: 100, estado: false },
        ],
        residuos,
        historial,
        // Caso adverso para las futuras consultas reales: no contar/pesar dos veces.
        historialConDuplicado: [...historial, { ...historial[0], id_historial: 200 }],
        premios: [{ id_premio: 7, nombre: 'Premio de prueba', descripcion: 'Fixture local', costo: 5, stock: 2 }],
        canjes: [{ id_usuario_premio: 9, id_user: 1, id_premio: 7, fecha_obtencion: '2026-02-02' }],
        logros: [{ id_logro: 8, nombre: 'Primer reciclaje', tipo_condicion: 'cantidad_residuos', valor_objetivo: 1 }],
        logrosUsuario: [{ id_user: 1, id_logro: 8, fecha_obtencion: '2026-01-15' }],
        cuentaInexistente: { id_user: 999, mensaje: 'Esta cuenta no existe', statusCode: 404 },
        filtros: {
            enero: { desde: '2026-01-01', hasta: '2026-02-01' },
            febrero: { desde: '2026-02-01', hasta: '2026-03-01' },
            vacio: { desde: '2026-03-01', hasta: '2026-04-01' },
        },
        limitesMes: [
            { instanteUTC: '2026-02-01T04:59:59.999Z', diaLima: '2026-01-31', mesLima: '2026-01' },
            { instanteUTC: '2026-02-01T05:00:00.000Z', diaLima: '2026-02-01', mesLima: '2026-02' },
        ],
        resultados: {
            estadisticasUsuario1: { cantidad_residuos: 3, peso_total_kg: 1, puntos_acumulados: 10 },
            estadisticasUsuario1Enero: { cantidad_residuos: 2, peso_total_kg: 0.75, puntos_acumulados: 7.5 },
            estadisticasUsuario1Febrero: { cantidad_residuos: 1, peso_total_kg: 0.25, puntos_acumulados: 2.5 },
            sinActividad: { cantidad_residuos: 0, peso_total_kg: 0, puntos_acumulados: 0 },
            // Orden por ID en este ejemplo; no representa posiciones de ranking.
            actividadHistorica: [
                { id_user: 1, puntosGanados: 10, cantidadResiduos: 3, pesoTotalKg: 1 },
                { id_user: 2, puntosGanados: 10, cantidadResiduos: 1, pesoTotalKg: 1 },
                { id_user: 3, puntosGanados: 5, cantidadResiduos: 1, pesoTotalKg: 0.5 },
                { id_user: 4, puntosGanados: 2.5, cantidadResiduos: 1, pesoTotalKg: 0.25 },
            ],
            actividadEnero: [
                { id_user: 1, puntosGanados: 7.5, cantidadResiduos: 2, pesoTotalKg: 0.75 },
                { id_user: 2, puntosGanados: 10, cantidadResiduos: 1, pesoTotalKg: 1 },
                { id_user: 3, puntosGanados: 5, cantidadResiduos: 1, pesoTotalKg: 0.5 },
                { id_user: 4, puntosGanados: 2.5, cantidadResiduos: 1, pesoTotalKg: 0.25 },
            ],
            actividadFebrero: [{ id_user: 1, puntosGanados: 2.5, cantidadResiduos: 1, pesoTotalKg: 0.25 }],
            actividadVacia: [],
            participacionEnero: { participantes: 2, denominador: 3, tasaPorcentaje: 100 * 2 / 3 },
            participacionSinCuentasElegibles: { participantes: 0, denominador: 0, tasaPorcentaje: null },
        },
        eventos: {
            residuoRegistrado: {
                idUser: 1, idResiduo: 42, idTacho: 3, tipo: 'plastico',
                peso: 0.25, puntosGanados: 2.5, fecha: new Date('2026-01-15T15:00:00.000Z'),
            },
            logroOtorgado: { idUser: 1, idLogro: 8, nombre: 'Primer reciclaje' },
            premioCanjeado: { idUser: 1, idPremio: 7, nombrePremio: 'Premio de prueba' },
        },
        // Propuesta R2 aprobada; no afirmar que el emisor de R1 ya añade idCanje.
        eventosR2: {
            premioCanjeado: { idUser: 1, idPremio: 7, nombrePremio: 'Premio de prueba', idCanje: 9 },
        },
        // Datos de prueba del contrato, no cola ni implementación de reintentos.
        recuperacion: {
            referenciaEvento: { nombre: 'residuo.registrado', idResiduo: 42 },
            trasCaida: [
                { consumidor: 'logros', confirmado: true },
                { consumidor: 'notificaciones', confirmado: false },
            ],
            reintentos: [
                { idUser: 1, idResiduo: 42, idTacho: 3, tipo: 'plastico', peso: 0.25, puntosGanados: 2.5, fecha: new Date('2026-01-15T15:00:00.000Z') },
                { idUser: 1, idResiduo: 42, idTacho: 3, tipo: 'plastico', peso: 0.25, puntosGanados: 2.5, fecha: new Date('2026-01-15T15:00:00.000Z') },
            ],
        },
        avisos: [
            { efecto: 'registro', destinatarios: [4], referencia: { idUserRegistrado: 5 } },
            { efecto: 'entrada-top10', destinatarios: [1], referencia: { transicion: 'entrada-1', periodo: '2026-02' } },
            { efecto: 'reciclaje', destinatarios: [1], referencia: { idResiduo: 42 } },
            { efecto: 'logro', destinatarios: [1], referencia: { idUser: 1, idLogro: 8 } },
            { efecto: 'canje', destinatarios: [1], referencia: { idCanje: 9 } },
            { efecto: 'premio-nuevo', destinatarios: [1, 2, 5], referencia: { idPremio: 7 } },
            { efecto: 'novedad', destinatarios: [1, 2, 5], referencia: { novedad: 'novedad-fixture-1' } },
        ],
    };
}
