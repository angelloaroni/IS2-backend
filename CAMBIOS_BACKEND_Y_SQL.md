# Cambios del backend y de SQL: recepcion MQTT de tachos

## Alcance

Este documento resume los cambios hechos desde el inicio de la adaptacion de la
recepcion de tachos, cuando esta llegaba por HTTP, hasta la implementacion MQTT
actual.

El cambio solicitado afecta al backend, que ahora consume los mensajes del
broker Mosquitto. **No se modificaron** `database/schema.sql`,
`database/seed.sql` ni `database/migrations/20261014_create_notificacion.sql`.
La estructura SQL existente ya contiene las tablas necesarias para guardar el
estado del tacho y el evento de reciclaje.

## Estado anterior

La recepcion de un evento del tacho estaba implementada como el endpoint HTTP
`POST /api/tachos/recepcion`. El dispositivo enviaba un JSON de reciclaje en el
cuerpo de la solicitud y se autenticaba con el header `x-tacho-api-key`
configurado mediante `TACHO_API_KEY`.

Ese flujo ya procesaba el evento de reciclaje con el servicio de residuos, pero
no recibia el estado/ubicacion del tacho como un mensaje separado por MQTT.

## Cambios en el backend

### Suscripcion MQTT

- Se agrego la dependencia `mqtt`.
- Al iniciar `index.js`, se establece la conexion MQTT y se suscribe a ambos
  temas. Al cerrar el proceso se cierra tambien el cliente MQTT.
- La configuracion predeterminada es:

  ```dotenv
  MQTT_BROKER_URL=mqtt://192.168.18.143:1883
  MQTT_TOPIC_TACHO_ESTADO=smartbin/status
  MQTT_TOPIC_EVENTO_RECICLAJE=smartbin/recycle
  MQTT_USERNAME=
  MQTT_PASSWORD=
  ```

- El usuario y la contraseña MQTT son opcionales, pero el backend exige que se
  configuren juntos. La URL y los temas se pueden sobrescribir por entorno.
- La suscripcion usa QoS 1. Los errores de conexion, suscripcion o procesamiento
  se registran en la consola del backend.
- Se corrigio la llamada `subscribe` para pasar una lista de strings de tema,
  tal como espera la version instalada del cliente MQTT.

### Tema `smartbin/status`

El dispositivo publica el estado y la ubicacion del tacho:

```json
{
  "idTacho": 1,
  "latitud": -12.0464,
  "longitud": -77.0428,
  "capacidad": false
}
```

El servicio valida que el JSON contenga exactamente esos campos, que
`idTacho` sea positivo, las coordenadas esten dentro de sus rangos geograficos y
`capacidad` sea un booleano. Luego actualiza el tacho activo identificado por
`idTacho`.

El estado administrativo `estado` no forma parte del mensaje ni se altera:
continua controlando si el tacho esta habilitado o dado de baja.

### Tema `smartbin/recycle`

El dispositivo publica un evento de reciclaje:

```json
{
  "idEvento": "tacho-1-evento-3",
  "codUser": "12454512",
  "idTacho": 1,
  "tipo": "plastico",
  "peso": 2.6
}
```

El backend reutiliza el flujo de registro de residuos existente:

1. Valida el JSON, el `codUser` de ocho digitos y el `idEvento`.
2. Busca un usuario activo con ese `cod_user` y verifica que el tacho exista y
   este activo.
3. Valida el tipo y el peso; calcula los puntos en el servidor.
4. En una transaccion, inserta el residuo, inserta el historial y suma los
   puntos al usuario.
5. Confirma la transaccion y emite el evento interno de residuo registrado.

`idEvento` se guarda como clave de idempotencia. Si un mensaje QoS 1 se entrega
mas de una vez, el evento ya procesado no vuelve a insertar el residuo ni a
sumar puntos. Un error previo a la escritura, como usuario inexistente/inactivo,
se registra en consola y no completa el registro.

### Retirada de la entrada HTTP del dispositivo

Se retiro `POST /api/tachos/recepcion` y el middleware de API key usado
exclusivamente por ese endpoint. El registro HTTP de un residuo por parte de un
usuario autenticado en las rutas de cliente sigue siendo independiente y no se
elimino.

## Cambios de SQL y persistencia

### DDL: sin cambios

No se agregaron columnas, tablas, restricciones ni migraciones para MQTT. Los
mensajes se almacenan usando el esquema actual:

| Dato recibido | Tabla y columnas existentes | Operacion |
|---|---|---|
| Estado del tacho | `tachointeligente`: `latitud`, `longitud`, `capacidad` | `UPDATE` del tacho activo por `id_tacho` |
| Residuo reciclado | `residuo`: `peso`, `tipo`, `idempotency_key`, `id_user`, `id_tacho` | `INSERT`; la clave de idempotencia es unica |
| Historial | `historialreciclaje`: `fecha`, `id_user`, `id_tacho`, `id_residuo` | `INSERT` en la misma transaccion |
| Puntos | `usuario`: `puntos` | Incremento en la misma transaccion |

La tabla `residuo` tiene una clave foranea al usuario y al tacho. La tabla
`historialreciclaje` relaciona al usuario, el tacho y el residuo. Estas claves
foraneas y la restriccion unica de `idempotency_key` ya estaban definidas en
`database/schema.sql`; el servicio usa esas estructuras, no las crea.

La aplicacion ejecuta las operaciones mediante Sequelize y los repositorios.
Ademas, los repositorios bloquean las tablas correspondientes durante la
asignacion de identificadores enteros (`MAX(id) + 1`). No se agrego una
sentencia SQL a los archivos de esquema o seed para el procesamiento MQTT.

### Comprobaciones manuales en PostgreSQL

Despues de publicar un estado, consulta el tacho. Sustituye `1` por el
identificador publicado:

```sql
SELECT id_tacho, latitud, longitud, capacidad, estado
FROM tachointeligente
WHERE id_tacho = 1;
```

Despues de publicar un evento, busca su `idEvento` (guardado en
`idempotency_key`) y revisa tambien el historial y los puntos:

```sql
SELECT r.id_residuo,
       r.idempotency_key,
       r.tipo,
       r.peso,
       h.fecha,
       u.cod_user,
       u.puntos,
       r.id_tacho
FROM residuo AS r
JOIN historialreciclaje AS h ON h.id_residuo = r.id_residuo
JOIN usuario AS u ON u.id_user = r.id_user
WHERE r.idempotency_key = 'tacho-1-evento-3';
```

Los identificadores SQL se escriben en minusculas porque PostgreSQL convierte
los nombres no entrecomillados de las sentencias `CREATE TABLE` a minusculas.

## Datos de prueba del seed actual

`database/seed.sql` ya incluye tachos con IDs `1`, `2` y `3`, y usuarios con
codigos `00001001`, `00001002` y `00001003`. No incluye el codigo `12454512` del
JSON de ejemplo. Para que el evento de reciclaje de ejemplo se procese, el
usuario indicado en `codUser` debe existir y tener `estado = TRUE`; tambien debe
existir y estar activo el `idTacho` indicado.

El seed es datos de ejemplo, no una migracion necesaria para MQTT. No se debe
volver a ejecutar a ciegas sobre una base que ya contiene esas filas, porque
sus `INSERT` no son idempotentes.

## Configuracion y comprobacion

Configura la conexion PostgreSQL en el archivo `.env` de la raiz del backend.
Para PostgreSQL local sin SSL, deja `DATABASE_URL` vacio y configura
`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` y `DB_PORT`. El cliente MQTT se
conecta a `192.168.18.143:1883` por defecto.

Al arrancar el backend debe aparecer un mensaje equivalente a:

```text
Suscrito a temas MQTT: smartbin/status, smartbin/recycle
```

Este mensaje confirma la conexion y suscripcion MQTT, pero no una escritura en
PostgreSQL. Para verificar la persistencia, publica un mensaje valido y ejecuta
las consultas SQL anteriores. Las pruebas automatizadas cubren la validacion y
el mapeo del JSON de estado; no sustituyen una prueba de integracion con la
base de datos y el dispositivo reales.
