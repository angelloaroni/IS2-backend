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

Los datos de los tachos se reciben por MQTT desde el broker Mosquitto en `192.168.18.143:1883` por defecto. El backend se suscribe a `smartbin/status` para el estado del tacho y a `smartbin/recycle` para eventos de reciclaje. La URL y los temas se pueden sobrescribir con `MQTT_BROKER_URL`, `MQTT_TOPIC_TACHO_ESTADO` y `MQTT_TOPIC_EVENTO_RECICLAJE`. Si el broker requiere autenticación, configura conjuntamente `MQTT_USERNAME` y `MQTT_PASSWORD`.

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
  "idEvento": "identificador-unico-generado-por-el-tacho",
  "codUser": "00001001",
  "idTacho": 1,
  "tipo": "plastico",
  "peso": 0.25
}
```

Los tipos aceptados son `plastico`, `papel/carton` y `organicos`. `idEvento` se usa como clave de idempotencia; reutilizarla no vuelve a registrar el residuo ni sumar puntos. El servidor resuelve el usuario a partir de `codUser`, verifica que el usuario y el tacho estén activos, y obtiene la fecha y los puntos; el tacho no debe enviarlos. La antigua ruta HTTP `POST /api/tachos/recepcion` ya no está disponible.
