# Contratos de API y eventos

Fuente: PDF, páginas 2, 4, 6 y 8, y [acuerdos aprobados](decisiones.md).
Las rutas de B descritas aquí están implementadas; requieren aplicar la migración
de Release 2 antes de iniciar el backend.

## Compatibilidad de Release 1

- ESM e imports `.js`; HTTP → controlador → servicio → repositorio/BD.
- `/api`, JWT Bearer y consulta del usuario vigente en BD; conservar 401 sin
  autenticación y 403 para rol insuficiente. Cuenta inactiva pierde acceso incluso
  con JWT emitido antes. No introducir autenticación provisional.
- `req.usuario = {id_user,cod_user,nombre,tipo,estado}`. Datos propios usan identidad
  del token, nunca `id_user` del cuerpo, `x-user-id` o `x-cod-user`.
- Éxito `{ok:true,data,error:null}`; fallo `{ok:false,data:null,mensaje}`.
  No devolver contraseñas, hashes ni detalles internos de BD.

| Ruta existente bajo `/api` | Acceso y compatibilidad |
| --- | --- |
| `POST /auth/login`, registro, códigos, recuperación | Conservar flujos públicos y verificación de R1 |
| `GET /usuarios` | Cuenta autenticada, nunca listado global |
| `GET /usuarios/me/historial`, `/usuarios/me/metricas` | Datos del usuario autenticado |
| `DELETE /usuarios/:id` | Solo admin; baja lógica |
| `POST /residuos` y alternativas R1 | Identidad del token, idempotencia y respuestas conservadas |
| `GET /tachos`, `/tachos/:id`, `/tachos/cercanos` | JWT; tachos activos. Cercanía lat/lng/radio en metros, distanciaM ascendente; 5000 por defecto, máximo 50000 |
| `POST /tachos`, `PUT/DELETE /tachos/:id` | Solo admin |
| `GET /premios`, `POST /premios/:id/canjear` | Autenticado; conservar canje, premio y puntos_restantes |
| `POST /premios` | Solo admin |
| `GET /ranking` | Autenticado; conservar top, total_usuarios, usuario |
| `GET /logros`, `GET /notificaciones` | Autenticado, datos propios |
| `POST /logros`, `POST /notificaciones/sistema` | Solo admin |

`obtenerMetricas(idUser)` conserva totalResiduos, pesoTotalKg, porTipo, porPeriodo y
porTipoYPeriodo. `obtenerTachosCercanos({lat,lng,radio})` no recibe idUser. No editar
archivos antiguos o vacíos por similitud de nombre con los routers activos.

## Rutas de R2 implementadas

| Ruta bajo `/api` | Permiso | Alcance acordado |
| --- | --- | --- |
| `GET /dashboard/materiales` | Solo admin | Kg/cantidad por material/período; filtros compartidos desde/hasta; totales y series vacías coherentes |
| `GET /dashboard/participacion` | Solo admin | Participantes distintos, denominador y tasa aprobados en datos.md |
| `GET /usuarios/admin?pagina=1&limite=20&q=ana` | Solo admin | Búsqueda/paginación; sin hashes |
| `GET/PATCH /usuarios/admin/:id` | Solo admin | Detalle; edición solo nombre y estado |
| `PATCH /usuarios/me` | Autenticado, identidad del token | Solo nombre |
| `GET/PUT /ranking/config` | Solo admin, ambos métodos | `PUT` reemplaza `{desde, hasta, excluidos}` |
| `GET /ranking/reciclador-mes?mes=YYYY-MM` | Cuenta registrada activa, JWT | Mes Lima; ganador o null sin actividad |

Campos desconocidos y código/rol/saldo/contraseña no se modifican mediante PATCH
genérico. Correo requiere un alcance verificado independiente y no se añade aquí.
El GET del ranking y el ganador son visibles a usuarios registrados activos;
consultarlos no otorga permiso para leer o modificar configuración.

HU12, por decisión delegada: mantener posiciones calculadas por puntos ganados
DESC e id_user ASC. Excluir participantes solo del ranking no bloquea su cuenta.
Reiniciar selecciona otro período sin borrar actividad. Top, posición propia y
ganador usan un solo motor. No hay edición manual de posiciones. La configuración
persiste límites opcionales `[desde,hasta)` y una lista de ids de usuarios excluidos;
el orden sigue fijo por puntos ganados DESC e `id_user` ASC. GET `/ranking` puede
recibir `desde` y/o `hasta` para una consulta sin cambiar la configuración.

La lista admin responde `{ usuarios, pagina: { actual, limite, total, paginas } }`.
La respuesta del ranking conserva `top`, `total_usuarios` y `usuario`, y agrega
`criterio` y `periodo`. GET del reciclador responde `{ mes, criterio, ganador }`.

## Interfaces A → B

```js
obtenerEstadisticasUsuario(idUser, { desde, hasta } = {})
// Promise<{cantidad_residuos, peso_total_kg, puntos_acumulados}>
listarActividadPorUsuario({ desde, hasta } = {})
// Promise<Array<{id_user,puntosGanados,cantidadResiduos,pesoTotalKg}>>
```

Límites opcionales `YYYY-MM-DD`, `[desde,hasta)` en America/Lima. Sin filtros:
histórico. Ganado independiente de saldo y canjes; proveedor de solo lectura,
sin posiciones, elegibilidad ni premios. Cuenta existente sin actividad: ceros.
Cuenta inexistente: `new AppError('Esta cuenta no existe', 404)`.

El middleware existente ya presenta una respuesta legible, sin añadir endpoint:

```json
{ "ok": false, "data": null, "mensaje": "Esta cuenta no existe" }
```

Fixtures y dobles de `src/stubs/release2/` publican ambas firmas. El proveedor real
llega en A6; B lo reemplaza en sus pruebas de consumidores sin reconstruir joins.
No se modifica el método actual del repositorio de logros para conectarlo al doble.

## Eventos existentes y ampliación acordada

`src/utils/eventos.js` conserva nombres y bus actual. `listeners.js` inicia el
consumidor persistente de B; no se ejecuta en paralelo con listeners B en memoria.

| Evento existente | Payload R1 | Regla |
| --- | --- | --- |
| `residuo.registrado` | idUser, idResiduo, idTacho, tipo, peso, puntosGanados, fecha | A → B después del commit; idResiduo estable |
| `logro.otorgado` | idUser, idLogro, nombre | B → B solo tras inserción nueva; no emitir si ya existía |
| `premio.canjeado` | idUser, idPremio, nombrePremio | B → B después del canje confirmado |

El evento de canje R2 incluye **idCanje = id_usuario_premio**. Los productores
persisten los eventos pendientes en la misma transacción del efecto; el consumidor
de B confirma cada efecto y su entrega conjuntamente, con reintentos y referencias
idempotentes. Se conserva el payload de `residuo.registrado`.

Ejemplo compatible del PDF:

```js
{ idUser: 1, idResiduo: 42, idTacho: 3, tipo: 'plastico',
  peso: 0.25, puntosGanados: 2.5, fecha: new Date('2026-01-15T15:00:00.000Z') }
```

Fecha de servidor y Date conservados. En pruebas usar bus local, no singleton
con listeners de producción. Reciclaje sigue por la misma transacción, no crear
un registro alternativo que compita con registrarResiduo.

## Avisos y recuperación aprobados

HU19 es bandeja API persistida, sin añadir push o correo externo.

| Efecto confirmado | Destinatario | Referencia para evitar duplicados |
| --- | --- | --- |
| Reciclaje | Usuario del reciclaje | idResiduo y consumidor |
| Logro/medalla nueva | Usuario que lo obtiene | Usuario/logro y consumidor |
| Canje | Usuario del canje | idCanje y consumidor |
| Registro de cuenta | Administradores | Cuenta registrada y consumidor/destinatario |
| Entrada al top 10 | Usuario que ingresa | Referencia estable de transición y período, por consumidor |
| Premio nuevo | Usuarios activos | Premio creado y consumidor/destinatario |
| Novedad | Usuarios activos | Referencia estable de la novedad y consumidor/destinatario |

Entrar de nuevo al top es una transición distinta; reintentar la misma transición
no crea otro aviso. El consumidor persiste el estado del top 10 por mes Lima y
solo notifica al detectar una entrada. Leer el ranking no crea notificaciones.

Se exige recuperación tras caída: persistir pendiente en transacción del productor;
entrega y efecto se confirman juntos por consumidor. Reintentos conservan referencia
y destinatario; cada consumidor guarda su entrega, de modo que logros procesado no
oculte una notificación pendiente. El outbox registra `residuo.registrado` dentro
de la transacción de reciclaje y los productores B guardan canjes, logros, altas y
premios nuevos con sus efectos. La migración incluye backoff/reintentos y el
marcador de entrega por consumidor.

Los fixtures siguen siendo ejemplos; la cola productiva vive en
`evento_pendiente`/`entrega_evento`. El trabajador se inicia desde
`src/utils/listeners.js`; no se añade push o correo externo.

## MQTT conservado

- `smartbin/status`: formatos admitidos por R1, idTacho y coordenadas/capacidad;
  extensión existente id_tacho/tipo/porcentaje conservada. No reinterpretar estado.
- `smartbin/recycle`: idEvento, codUser, idTacho, tipo, peso y alias existentes;
  usuario/tacho activos; idempotencia; puntos/fecha del servidor.
- Identificación codUser confirmada. Credenciales/ACL del broker autentican
  dispositivo, no reemplazan identidad de cuenta ni JWT. No reactivar
  `POST /tachos/recepcion` ni introducir QR/RFID.
