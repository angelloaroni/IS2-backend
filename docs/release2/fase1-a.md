# Fase 1 · Entrega del desarrollador A

Rama: `Sprint2/Fase1`, desde `Sprint2/Fase0-Completada`
(`7ab49b1335fc4718236557899ecd23305b824485`). El cambio de nombre de Fase 0 fue
posterior a sus documentos; las referencias a Modificaciones-Angello son históricas.

## Alcance y autorizaciones

Fuente principal: páginas 3–4, 7–8 y 10–11 del PDF. Se implementan A1–A6, sin los
servicios de administración, perfil, canjes, ranking, logros o avisos de B.

El usuario aprobó expresamente, para esta fase:

1. `puntos_ganados` FLOAT y `fecha_instante` TIMESTAMPTZ opcional para históricos;
   nuevos registros guardan instante y día de Lima; backfill con peso × 10.
2. Vista por residuo que elimina duplicados idénticos y rechaza contradicciones.
3. Agrupaciones mensuales, las respuestas de dashboard descritas abajo, material
   como filtro en materiales/métricas y filtros inválidos/desconocidos con 400.
4. Montaje mínimo del router dashboard en `index.routes.js`, propiedad habitual de B.
5. Tablas de pendientes y entregas por consumidor, dejando activación/trabajadores
   para Fase 2 y conservando mientras tanto listeners R1.

No se añadieron dependencias ni se cambiaron JWT, registro, recuperación o tarifas.

## Entregables por paquete

| Paquete | Resultado |
| --- | --- |
| A1 · HU16 | Dashboard de kg/cantidad, material/período, vacíos coherentes y protección admin |
| A2 · HU17 | Usuarios distintos activos, denominador actual y tasa; cero denominador → null |
| A3 · HU18 | Métricas del token con filtros sin alterar sus cinco campos; sin equivalencias no aprobadas |
| A4 · HU25 | Se reutiliza MQTT; validaciones y rechazos sin efectos; ganado/instante/evento atómicos e idempotencia concurrente probada |
| A5 · HU5 | Listado, detalle y cercanía existentes conservados; pruebas de activos, coordenadas, radio, distancias y vacíos |
| A6 | Migración R1/nueva repetible, vista sin doble conteo, proveedor real con contrato de Fase 0 e infraestructura productora de eventos |

## Migración y arranque

Aplicar las migraciones **antes** de arrancar la nueva versión; no mezclar escrituras
con el binario antiguo durante la migración. Se necesita respaldo y revisión de datos
para un despliegue real; aquí solo se aplicó a la base local de desarrollo y a BD
temporales de prueba.

Con las variables de conexión de PostgreSQL configuradas de forma segura:

```sh
psql -v ON_ERROR_STOP=1 -f database/migrations/20261105_release2_actividad.sql
psql -v ON_ERROR_STOP=1 -f database/migrations/20261105_release2_eventos_pendientes.sql
npm start
```

Para una base vacía: `psql -v ON_ERROR_STOP=1 -f database/schema.sql`.
Los archivos incluyen sus transacciones y se probaron dos veces. Rellenar ganado
no modifica saldo ni los DATE existentes. No ejecutar el seed antiguo para esta
validación: los fixtures de R2 están separados.

Si la migración encuentra materiales/pesos inválidos o historial contradictorio,
se revierte. Deben revisarse esas filas con el usuario antes de corregirlas; no se
elige una fecha arbitraria ni se renombra un material histórico silenciosamente.
No se inventan horas históricas: `fecha_instante` queda null para ellas.

La vista `actividad_reciclaje` entrega una fila por residuo enlazado al historial.
Duplicados idénticos no multiplican kg/cantidad/ganado. Diferencias en usuario,
tacho, fecha o instante provocan rechazo; también se detectan después de migrar.
Las consultas leen en una transacción de snapshot consistente.

## APIs de A

Todas bajo `/api`. Respuestas con envoltura R1; sin JWT 401, usuario sin permiso
admin 403, cuenta inactiva 401. No se admite identidad de usuario desde query/body.

```http
GET /api/dashboard/materiales?desde=2026-01-01&hasta=2026-02-01&material=plastico
Authorization: Bearer <jwt-admin>
```

Datos: `{totalResiduos,pesoTotalKg,porTipo,porPeriodo,porTipoYPeriodo}`. Es la misma
forma de agregación de las métricas; las series se agrupan por mes, con `periodo`
YYYY-MM. `porTipo` usa `{tipo,cantidad,pesoKg}`; `porPeriodo`,
`{periodo,totalResiduos,pesoTotalKg}`; `porTipoYPeriodo`,
`{periodo,tipo,cantidad,pesoKg}`. Sin actividad: totales 0 y listas vacías.

```http
GET /api/dashboard/participacion?desde=2026-01-01&hasta=2026-02-01
Authorization: Bearer <jwt-admin>
```

Datos: `{participantes,denominador,tasaPorcentaje,porPeriodo}`. Cada elemento de
porPeriodo contiene periodo y esos tres indicadores. Usuarios tipo usuario activos
al consultar; excluir admins/inactivos de numerador y denominador, incluyendo en
el denominador usuarios sin actividad. Cada período cuenta usuarios distintos,
no la suma de participantes de períodos anteriores. Sin cuentas elegibles:
`{participantes:0,denominador:0,tasaPorcentaje:null,porPeriodo:[]}`.

```http
GET /api/usuarios/me/metricas?desde=2026-01-01&hasta=2026-02-01&material=plastico
Authorization: Bearer <jwt-usuario>
```

Los mismos cinco campos públicos de R1, limitados al usuario del JWT.
`desde`/`hasta` son opcionales YYYY-MM-DD en Lima, intervalo `[desde,hasta)`;
`material` admite plastico, papel/carton u organicos, solo en materiales/métricas.
No hay parámetro de agrupación configurable: se aprobó agrupación mensual.
Fechas imposibles, rangos vacíos/invertidos, arrays o campos ajenos dan 400.

## Proveedor real para B

```js
import {
    obtenerEstadisticasUsuario,
    listarActividadPorUsuario,
} from '../../src/services/estadistica.service.js';
```

Estas funciones conservan firmas/campos de Fase 0. El listado no aplica elegibilidad
ni ranking: B decide con las cuentas/configuración. Cuenta existente sin actividad:
ceros; inexistente: AppError 404 `Esta cuenta no existe`. Contradicción: AppError 409,
sin revelar errores internos. El ganador, posiciones y logros no se implementan aquí.

El verificador de `src/stubs/release2/verificar-estadisticas.js` pasa con el doble
**y con el proveedor real** sobre los mismos fixtures. B puede cambiar la dependencia
sin reconstruir joins. Cambiar saldo no cambia ganado; la prueba usa un descuento
controlado, no presenta el servicio de canje de B como ya aceptado.

## Pendientes y frontera con B

A escribe `evento_pendiente` dentro de la transacción de reciclaje. El payload JSON
conserva campos existentes; fecha se serializa como ISO y debe convertirse a Date
si se vuelve a publicar en el bus con el contrato vigente. `nombre/referencia`
identifican evento; para reciclaje, referencia es idResiduo.

`entrega_evento` tiene PK evento/consumidor, confirmación, intentos y próxima fecha.
A no crea consumidores ni activa el worker; no se afirma recuperación tras caída
hasta su implementación/prueba en Fase 2. Los listeners R1 siguen funcionando y
la tabla de pendientes no se debe consumir automáticamente en paralelo.

B debe coordinar un corte de activación: distinguir pendientes anteriores que ya
produjeron efectos R1, conciliar sus entregas y no reproducirlos ciegamente como
nuevos. A partir del corte, desactivar el listener viejo para cada efecto que se
traslade al camino recuperable, y confirmar entrega junto con ese efecto. El
estado de un consumidor no debe ocultar pendientes de otro. El diseño/aprobación
del corte y las migraciones propias de configuración de ranking o deduplicación
que B necesite se coordinan antes de activar. No hay dependencia de código B para
terminar o probar los módulos de A entregados aquí.

La revisión cruzada de B y el recorrido integrado de Fase 2/3 siguen pendientes;
no se afirma haber revisado un PR de B que aún no se proporcionó. No se modifican
los servicios/repositorios de B ni sus listeners para simular esa integración.

## Validaciones

- `npm test` normal: 43 aprobadas y un grupo de integración omitido explícitamente.
- Suite completa con `R2A_INTEGRATION=1`: **57 aprobadas, 0 fallidas, 0 omitidas**.
  Incluye 13 subcasos de integración y su grupo padre, todos ejecutados.
- Integración: BD nuevas aisladas para migración R1, creación vacía y rechazo;
  se eliminan al terminar. HTTP con JWT/roles reales, métricas privadas y MQTT real
  con temas aislados. No se usa autenticación provisional.
- Verificados rollback de actividad/saldo/historial si falla el pendiente y dos
  registros concurrentes con una clave: un solo efecto, el otro 409.
- Backend reiniciado con las migraciones locales; prueba de registro, correo SMTP
  capturado, verificación, login, métricas y estado MQTT nuevamente aprobada.
- Proyecto ESM sin comando de compilación. Se verificó ejecución y sintaxis de los
  módulos cambiados; no se incorporó un build.

Para reproducir la integración, PostgreSQL debe permitir crear bases temporales y
el broker de pruebas debe estar disponible:

```sh
# Configurar DB_HOST, DB_PORT, DB_USER y DB_PASSWORD sin imprimir sus valores.
# Opcional R2A_MQTT_URL; por defecto mqtt://127.0.0.1:1883.
R2A_INTEGRATION=1 npm test
```

Nunca se migra la base indicada por DB_NAME durante estas pruebas: se generan
nombres r2a_... exclusivos y se eliminan con sus conexiones. `DATABASE_URL` no se
utiliza para la BD temporal. El snapshot `test/fixtures/r1-schema.sql` es exacto de
Fase 0 y permite probar una actualización real sin perder la referencia original.
