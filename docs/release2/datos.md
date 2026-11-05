# Datos comunes de Release 2

Fuente: PDF, páginas 2, 7 y 8, y [acuerdos del usuario](decisiones.md).

## Base de R1 conservada

| Dato | Persistencia R1 | Semántica |
| --- | --- | --- |
| Saldo | `usuario.puntos` | Aumenta al reciclar; disminuye al canjear |
| Actividad | `residuo` | `id_residuo`, `peso`, `tipo`, `idempotency_key`, `id_user`, `id_tacho` |
| Fecha | `historialreciclaje.fecha` (`DATE`) | Día sin hora ni zona; enlace por `id_residuo` |
| Cuenta | `usuario.cod_user`, JWT y `req.usuario` | Código de ocho dígitos; JWT autentica al cliente |
| Tacho | `tachointeligente` | `estado` administrativo, `capacidad` boolean y `porcentaje` 0–100 son distintos |
| Canje | `usuario_premio` | Referencia `id_usuario_premio`, usuario, premio y fecha |
| Logros | `logros`, `logros_usuario` | Condición estructurada, PK compuesta usuario/logro |
| Avisos | `notificacion` | Bandeja propia con referencia idempotente; outbox por consumidor |

`registrarResiduo` confirma residuo, historial y saldo en una transacción; emite
`residuo.registrado` después del commit. En R2 el mismo evento queda además
persistido en el outbox dentro de la transacción. Se mantienen 10 puntos/kg para
`plastico`, `papel/carton`, `organicos`. El usuario confirmó que esa tarifa rigió
históricamente; el proveedor compartido deriva ganado como peso × 10 sin consultar
el saldo canjeable.

## Consultas compartidas A → B

Firmas de página 8 publicadas en `src/stubs/release2/contratos.js`:

```js
obtenerEstadisticasUsuario(idUser, { desde, hasta } = {})
// Promise<{cantidad_residuos, peso_total_kg, puntos_acumulados}>
listarActividadPorUsuario({ desde, hasta } = {})
// Promise<Array<{id_user, puntosGanados, cantidadResiduos, pesoTotalKg}>>
```

- Números JavaScript; peso en kg; cantidad cuenta actividades/residuos únicos.
- Sin filtros: histórico. Límite omitido: sin restricción por ese extremo.
- Cuenta existente sin actividad: tres ceros. Cuenta inexistente:
  `AppError('Esta cuenta no existe', 404)`.
- `puntos_acumulados` y `puntosGanados` representan ganado, no saldo disponible.
- El listado entrega datos de actividad, sin decidir elegibilidad/posiciones ni
  otorgar premios. B cruza con cuentas y configuración elegibles.
- No cambiar `obtenerMetricas(idUser)` ni `obtenerTachosCercanos({lat,lng,radio})`;
  no añadir `idUser` a cercanía. Métricas mantiene sus campos de R1.

El proveedor está conectado en `src/repositories/metrica.repository.js` y mantiene
las firmas del contrato. B no duplica joins en los repositorios de ranking/logros.
El doble sigue reservado para pruebas aisladas. A6 podrá reemplazar la derivación
de puntos por actividad persistida sin cambiar estas firmas.

## Períodos y fechas aprobados

Mes calendario `America/Lima`, límites opcionales `YYYY-MM-DD` y `[desde,hasta)`.
`desde` se incluye, `hasta` se excluye. Los DATE históricos se interpretan como
**días de Lima**, sin convertirlos en supuestos instantes UTC. No reconstruir una
hora que nunca se guardó. Para eventos nuevos el payload persistido conserva el
instante UTC; la columna DATE del historial se escribe como día de Lima. El formato
público del evento sigue siendo `Date`.

Ejemplo: enero tiene desde `2026-01-01` y hasta `2026-02-01`.
`2026-02-01T04:59:59.999Z` sigue en enero de Lima;
`2026-02-01T05:00:00.000Z` pertenece a febrero. Son escenarios compartidos para
consultas posteriores, no una migración de los DATE existentes.

## Indicadores e impacto

- Materiales: kg y cantidad de actividades por material/período; totales 0 y series
  vacías cuando no hay actividad. No usar filas de historial duplicadas como actividades.
- Participantes: usuarios **distintos** tipo `usuario` activos al consultar, con
  actividad válida en el período. Denominador: todas las cuentas de ese tipo activas
  al consultar, incluidas las que no reciclaron. Excluir admins e inactivos de ambos.
- Tasa: `100 * participantes / denominador`; denominador 0 → `null`.
  No es una reconstrucción de qué cuentas estaban activas en una fecha pasada.
- No crear filtros por facultad/carrera: esos campos no existen.
- Impacto personal: kg/materiales, actividades y períodos. Por elección delegada,
  se difieren CO2, agua, árboles u otras equivalencias hasta disponer de factores
  con fuente, unidad y versión aprobadas. No incorporar librerías ni factores inventados.

Las formas locales de nuevos dashboards se concretan al implementar sus módulos;
los datos compartidos y la política temporal de arriba son comunes y estables.

## Esquema propuesto y secuencia de migración para A6

Esta sección sigue describiendo el entregable de diseño de Fase 0 para los campos
de actividad de A6. La migración B de configuración, exclusiones, referencias de
notificación, outbox y estado top 10 está en
`database/migrations/20261105_add_ranking_notifications_and_event_outbox.sql`;
no se aplicó a una BD durante esta sesión.

1. Persistir `puntos_ganados` por residuo y conservar una relación de actividad sin
   doble conteo. `id_residuo` es referencia estable; verificar cardinalidad del
   historial antes de fijar restricciones o resolver múltiples fechas.
2. Rellenar actividades históricas válidas con peso × 10, según confirmación del
   usuario, sin cambiar saldo ni recalcular con reglas nuevas. Diagnosticar filas
   inválidas/ambiguas; no convertirlas silenciosamente en cero.
3. Conservar DATE históricos; para nuevos datos añadir precisión de instante UTC.
   Definir con revisión los tipos SQL, precisión, nulabilidad e índices antes de
   migrar. No cambiar esos detalles por suposición en esta fase.
4. B comunica a A las necesidades de configuración de ranking, exclusiones y
   deduplicación. A centraliza nuevas migraciones y actualización de `schema.sql`.
   B adapta sus modelos al SQL acordado, sin migraciones paralelas de los mismos campos.
5. Incorporar persistencia de evento pendiente en la misma transacción que residuo,
   historial, ganado y saldo. La recuperación aprobada es por consumidor: guardar
   entrega con su efecto; evitar que logros oculte un aviso pendiente.
6. Probar creación nueva y copia de R1, rollback y repetición según contrato de cada
   migración, límites de mes, invariancia de ganado tras canje y ausencia de doble
   conteo. `COUNT(DISTINCT)` no corrige un `SUM(peso)` duplicado por un join.

El PDF advierte un COMMIT sin BEGIN en la migración de estado del tacho. La base
inspeccionada `20261018_add_tacho_status_fields.sql` sí contiene ambos; no se cambia.
A6 aún debe persistir `puntos_ganados` por actividad y probar sus consultas en una
BD aislada.

## Fixtures compartidos

`src/stubs/release2/fixtures.js` contiene cuentas activas/inactivas/admin/sin
actividad, tres materiales, dos meses, historial con duplicado como caso adverso,
tachos, premio, canje, logro, resultados y eventos. Incluye límites de mes, tasa y
escenarios de entrega por consumidor para los acuerdos aprobados. Se devuelven
copias independientes; no hay credenciales ni inserción automática en BD.

`crearDobleBaseRelease2()` publica escenarios listos para usar, incluidos ceros,
enero/febrero y cuenta inexistente. `crearDobleEstadisticas(escenarios)` permite
programar otros casos. Ninguno implementa agregaciones, ranking o recuperación.
`database/seed.sql` permanece intacto y no se ejecuta para estos escenarios.
