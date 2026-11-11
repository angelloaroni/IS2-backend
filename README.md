Instrucciones mínimas de uso del repositorio

- Instalar dependencias:

```bash
npm install
```

- Formatear el código con Prettier:

```bash
npm run format
```

Nota: este `README` solo contiene instrucciones de formato. Para más detalles, consulta los archivos de configuración (`.prettierrc`, `.eslintrc.json`).

## Reciclaje

### Métricas del usuario

`GET /api/usuarios/me/metricas` requiere autenticación de usuario y calcula los totales exclusivamente para el usuario autenticado. La respuesta incluye `totalResiduos`, `pesoTotalKg`, `porTipo`, `porPeriodo` (agrupado por mes) y `porTipoYPeriodo`.

### Recepción de datos del tacho

Los datos de los tachos y las validaciones de estudiantes se reciben por MQTT desde el broker Mosquitto en `192.168.18.143:1883` por defecto. El backend se suscribe a `smartbin/status` para el estado del tacho, `smartbin/recycle` para eventos de reciclaje, `smartbin/student/validate` para validar códigos de estudiante y `smartbin/events/last/request` para sincronizar secuencias. Las respuestas se publican en `smartbin/student/response`, `smartbin/product/response` y `smartbin/events/last/response`. La URL y los temas existentes se pueden sobrescribir con sus variables `MQTT_*`; los temas de secuencia son fijos. Si el broker requiere autenticación, configura conjuntamente `MQTT_USERNAME` y `MQTT_PASSWORD`.

El simulador solicita la validación enviando un código de ocho dígitos en JSON:

```json
{
  "codUser": "00001001"
}
```

El backend consulta `Usuario.cod_user` y publica tanto si el código existe como el código recibido:

```json
{
  "codUser": "00001001",
  "exists": true
}
```

`exists` es `false` cuando no hay un usuario con ese código.

### Validación de productos por QR

El simulador envía un código numérico de ocho dígitos al tema `smartbin/product/validate`:

```json
{
  "codProducto": "12345678"
}
```

El backend busca el código en la tabla `producto` y responde en `smartbin/product/response` con el código, tipo y `peso` en gramos:

```json
{
  "codProducto": "12345678",
  "tipo": "plastico",
  "peso": 25
}
```

Si no encuentra el producto, responde con `"tipo": "desconocido"` y `"peso": 0`. Los temas se pueden configurar con `MQTT_TOPIC_VALIDAR_PRODUCTO` y `MQTT_TOPIC_RESPUESTA_PRODUCTO`.

Los únicos tipos de material permitidos en residuos, productos y tachos son `plastico`, `papel/carton` y `vidrio`. La tabla de productos incluye código QR, nombre, peso en gramos y tipo. El esquema y los ejemplos se encuentran en `database/schema.sql` y `database/seed.sql`; para bases existentes, aplicar las migraciones de producto `20261109_create_producto.sql`, `20261109_add_producto_nombre.sql`, `20261109_update_producto_tipo_vidrio.sql` y `20261109_add_producto_peso_gramos.sql` en ese orden, y después `20261110_residuo_materiales_permitidos.sql`. La última migración detiene la actualización si encuentra residuos, productos o tachos con tipos no reconocidos; clasifícalos manualmente antes de volver a ejecutarla.

El tema `smartbin/status` recibe el identificador, ubicación y capacidad actual del tacho:

```json
{
  "idTacho": 1,
  "latitud": -12.0464,
  "longitud": -77.0428,
  "capacidad": true
}
```

El tacho debe existir y estar activo. Estos datos actualizan sus campos en la tabla `TachoInteligente`; `capacidad` es un booleano y no modifica el estado administrativo/activo del tacho.

El tema `smartbin/recycle` recibe:

```json
{
  "idEvento": "tacho-1-evento-42",
  "codUser": "00001001",
  "idTacho": 1,
  "tipo": "plastico",
  "peso": 25.5
}
```

Los tipos aceptados son `plastico`, `papel/carton` y `vidrio`. El servidor resuelve el usuario a partir de `codUser`, verifica que el usuario y el tacho estén activos, y obtiene la fecha y los puntos; el tacho no debe enviarlos. La antigua ruta HTTP `POST /api/tachos/recepcion` ya no está disponible.

`idEvento` debe seguir `tacho-{idTacho}-evento-{numero}`, por ejemplo
`tacho-1-evento-42`. El backend valida la concordancia con el tacho, y persiste
el mayor número en `mqtt_event_sequence` junto con cada evento en una transacción.
Un duplicado idéntico se omite; el mismo ID con datos distintos se registra como
conflicto.

Para obtener la secuencia, publica `{"idTacho":1}` en
`smartbin/events/last/request`. La respuesta QoS 1 en
`smartbin/events/last/response` es `{"idTacho":1,"lastEvent":42}` (o `0` si no
hay eventos). Para actualizar una base existente, aplica
`database/migrations/20261111_add_mqtt_event_sequence.sql`; para una base nueva,
la tabla se crea desde `database/schema.sql`.
