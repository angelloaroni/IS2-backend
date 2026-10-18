# Guía de uso de la API — Tachín Verde

Referencia para consumir las APIs HTTP del backend. Se centra en **qué datos recibe cada endpoint y qué datos devuelve**.

## Convenciones

En los ejemplos, `BASE_URL` es la URL del servidor seguida de `/api`; por ejemplo:

```text
http://localhost:3000/api
```

Para los ejemplos con cuerpo JSON se debe enviar:

```http
Content-Type: application/json
```

Las respuestas exitosas tienen esta envoltura:

```json
{
  "ok": true,
  "data": {},
  "error": null
}
```

En la tabla de cada endpoint, los campos indicados como **recibe** describen lo que se envía en el body, query string, ruta o header. **Devuelve** describe el objeto dentro de `data`.

En las rutas protegidas, primero inicia sesión y envía el JWT de la respuesta en el header:

```http
Authorization: Bearer <token>
```

Configura `JWT_SECRET` en el entorno del servidor con al menos 32 bytes aleatorios. Las contraseñas se guardan con hash bcrypt; las contraseñas antiguas en texto plano se convierten a hash al iniciar sesión correctamente.

El registro público solo permite crear cuentas de tipo `usuario`. Las cuentas `admin` deben provisionarse por un proceso administrativo confiable (por ejemplo, promoviendo una cuenta desde un proceso con acceso controlado a la base de datos), nunca enviando `"tipo": "admin"` al registro.

## 1. Registro e inicio de sesión

### 1.1 Registrar usuario

```http
POST /auth/registro
```

**Recibe** en el body:

```json
{
  "cod_user": "00001004",
  "nombre": "Ana Pérez",
  "tipo": "usuario",
  "contraseña": "mi-clave"
}
```

| Campo | Tipo | Requisito |
|---|---|---|
| `cod_user` | string | Obligatorio, ocho dígitos y único. |
| `nombre` | string | Obligatorio, no vacío. |
| `tipo` | string | Obligatorio; debe ser `usuario`. |
| `contraseña` | string | Obligatoria, no vacía y máximo 72 bytes en UTF-8. |

**Devuelve** HTTP 201: el objeto de usuario creado, sin el campo de contraseña. El servidor inicializa `puntos` en 0 y `estado` en `true`. El identificador se asigna al guardar.

Ejemplo de `data`:

```json
{
  "id_user": 4,
  "cod_user": "00001004",
  "nombre": "Ana Pérez",
  "puntos": 0,
  "tipo": "usuario",
  "estado": true
}
```

### 1.2 Iniciar sesión

```http
POST /auth/login
```

**Recibe** en el body:

```json
{
  "cod_user": "00001001",
  "contraseña": "mi-clave"
}
```

**Devuelve** HTTP 200: un objeto `usuario` sin la contraseña y un JWT en `token`. Usa ese token para acceder a las rutas protegidas.

Ejemplo de `data`:

```json
{
  "usuario": {
    "id_user": 1,
    "cod_user": "00001001",
    "nombre": "Carlos Pérez",
    "puntos": 150.5,
    "tipo": "usuario",
    "estado": true
  },
  "token": "<jwt-firmado>"
}
```

## 2. Residuos y reciclaje

### 2.1 Registrar un residuo desde cliente

Endpoint recomendado:

```http
POST /residuos
Authorization: Bearer <token>
```

**Recibe** en el body:

```json
{
  "idTacho": 1,
  "tipo": "plastico",
  "peso": 0.25,
  "idempotencyKey": "web-usuario-evento-000001"
}
```

| Campo | Tipo | Requisito |
|---|---|---|
| `idTacho` | entero | Entero positivo; debe corresponder a un tacho activo. |
| `tipo` | string | `plastico`, `papel/carton` u `organicos`. Acepta normalización de mayúsculas, espacios y acentos. |
| `peso` | número | Finito y mayor que cero. |
| `idempotencyKey` | string | Obligatoria, no vacía y hasta 128 caracteres. |

El usuario se determina a partir del JWT; no hace falta enviar `idUser`. Tampoco se envían puntos ni fecha: los determina el servidor.

**Devuelve** HTTP 201:

```json
{
  "ok": true,
  "data": {
    "idResiduo": 25,
    "peso": 0.25,
    "tipo": "plastico",
    "idUser": 1,
    "idTacho": 1,
    "puntosGanados": 2.5,
    "fecha": "2026-10-17T20:00:00.000Z"
  },
  "error": null
}
```

La clave de idempotencia debe ser distinta para cada reciclaje nuevo. Si se repite una clave ya registrada, el endpoint devuelve HTTP 409 y no vuelve a sumar puntos.

Tarifa aplicada: 10 puntos por kilogramo para cada uno de los tres materiales permitidos.

### 2.2 Rutas alternativas de registro

También aceptan el mismo header y body de la sección anterior:

```text
POST /residuo
POST /residuo/registrar-residuo
```

Para nuevas integraciones, utiliza `POST /residuos`.

## 3. Recepción de datos enviados por un tacho

El servidor se suscribe al broker Mosquitto al iniciar. Configura el broker y los temas en el entorno:

```dotenv
MQTT_BROKER_URL=mqtt://192.168.18.143:1883
MQTT_TOPIC_TACHO_ESTADO=smartbin/status
MQTT_TOPIC_EVENTO_RECICLAJE=smartbin/recycle
MQTT_USERNAME=
MQTT_PASSWORD=
```

El usuario y la contraseña son opcionales, pero deben configurarse juntos. El tema `smartbin/status` recibe:

```json
{
  "idTacho": 1,
  "latitud": -12.0464,
  "longitud": -77.0428,
  "capacidad": true
}
```

El tacho debe existir y estar activo. El backend persiste `latitud`, `longitud` y `capacidad` en la tabla `TachoInteligente`. `capacidad` es un booleano; `true` indica que alcanzó su capacidad. Este mensaje no cambia el estado administrativo del tacho.

El tema `smartbin/recycle` recibe:

```json
{
  "idEvento": "tacho-1-event-000045",
  "codUser": "00001001",
  "idTacho": 1,
  "tipo": "papel/carton",
  "peso": 0.5
}
```

`idEvento` funciona como clave de idempotencia. El backend valida y procesa el evento con las mismas reglas que el registro autenticado: resuelve el usuario por `codUser`, verifica usuario y tacho activos, y calcula puntos y fecha. MQTT QoS 1 permite la entrega al menos una vez; un evento repetido no vuelve a sumar puntos. La antigua ruta HTTP `POST /tachos/recepcion` ya no está disponible.

## 4. Tachos

Las respuestas serializadas de tacho contienen `idTacho`, `latitud`, `longitud` y `capacidad`.

### 4.1 Listar tachos activos

```http
GET /tachos
Authorization: Bearer <token>
```

**Recibe:** no requiere body ni parámetros.

**Devuelve** un arreglo de tachos:

```json
{
  "ok": true,
  "data": [
    {
      "idTacho": 1,
      "latitud": -12.0464,
      "longitud": -77.0428,
      "capacidad": false
    }
  ],
  "error": null
}
```

### 4.2 Obtener tacho por id

```http
GET /tachos/1
Authorization: Bearer <token>
```

**Recibe:** `id` como entero positivo en la ruta.

**Devuelve:** un objeto de tacho con `idTacho`, `latitud`, `longitud` y `capacidad`.

### 4.3 Buscar tachos cercanos

```http
GET /tachos/cercanos?lat=-12.0464&lng=-77.0428&radio=5000
Authorization: Bearer <token>
```

**Recibe** estos parámetros en query:

| Parámetro | Requerido | Valores |
|---|---|---|
| `lat` | Sí | Número entre -90 y 90. |
| `lng` | Sí | Número entre -180 y 180. |
| `radio` | No | Metros, mayor que 0 y máximo 50000. Si se omite, usa 5000. |

**Devuelve** un arreglo de tachos cercanos, ordenados por distancia ascendente. Cada objeto incluye las propiedades del tacho más `distanciaM`:

```json
{
  "ok": true,
  "data": [
    {
      "idTacho": 1,
      "latitud": -12.0464,
      "longitud": -77.0428,
      "capacidad": false,
      "distanciaM": 0
    }
  ],
  "error": null
}
```

### 4.4 Agregar tacho

```http
POST /tachos
Authorization: Bearer <token>
```

**Recibe** en el body:

```json
{
  "latitud": -12.0464,
  "longitud": -77.0428,
  "capacidad": false
}
```

Latitud debe estar entre -90 y 90, longitud entre -180 y 180, y `capacidad` debe ser `true` o `false`.

**Devuelve** HTTP 201: el tacho creado, incluyendo el `idTacho` asignado.

### 4.5 Editar tacho

```http
PUT /tachos/1
Authorization: Bearer <token>
```

**Recibe** en el body uno o varios de estos campos:

```json
{
  "latitud": -12.047,
  "longitud": -77.041,
  "capacidad": true
}
```

Todos son opcionales individualmente, pero se debe enviar al menos uno. No se admiten campos adicionales.

**Devuelve:** el tacho actualizado con `idTacho`, `latitud`, `longitud` y `capacidad`.

### 4.6 Dar de baja tacho

```http
DELETE /tachos/1
Authorization: Bearer <token>
```

**Recibe:** `id` como entero positivo en la ruta. No requiere body.

**Devuelve:**

```json
{
  "ok": true,
  "data": {
    "mensaje": "Tacho dado de baja correctamente"
  },
  "error": null
}
```

## 5. Usuario, historial y métricas

### 5.1 Consultar usuario propio

```http
GET /usuarios
Authorization: Bearer <token>
```

**Recibe:** no requiere body ni parámetros.

**Devuelve:** el objeto del usuario autenticado por el JWT, sin contraseña. Los campos corresponden a los atributos del modelo del usuario.

### 5.2 Consultar historial propio

```http
GET /usuarios/me/historial?pagina=1&limite=10
Authorization: Bearer <token>
```

**Recibe** estos parámetros opcionales:

| Parámetro | Predeterminado | Requisito |
|---|---:|---|
| `pagina` | 1 | Entero positivo. |
| `limite` | 10 | Entero positivo; máximo 100. |

**Devuelve** registros paginados. Cada registro contiene id del historial, fecha, id del tacho y tipo/peso del residuo:

```json
{
  "ok": true,
  "data": {
    "registros": [
      {
        "idHistorial": 10,
        "fecha": "2026-10-17",
        "idTacho": 1,
        "residuo": {
          "tipo": "plastico",
          "peso": 0.25
        }
      }
    ],
    "paginacion": {
      "pagina": 1,
      "limite": 10,
      "total": 14,
      "totalPaginas": 2
    }
  },
  "error": null
}
```

### 5.3 Consultar métricas propias

```http
GET /usuarios/me/metricas
Authorization: Bearer <token>
```

**Recibe:** no requiere body ni parámetros.

**Devuelve:**

```json
{
  "ok": true,
  "data": {
    "totalResiduos": 14,
    "pesoTotalKg": 6.3,
    "porTipo": [
      {
        "tipo": "plastico",
        "cantidad": 9,
        "pesoKg": 3.1
      }
    ],
    "porPeriodo": [
      {
        "periodo": "2026-10",
        "totalResiduos": 14,
        "pesoTotalKg": 6.3
      }
    ],
    "porTipoYPeriodo": [
      {
        "periodo": "2026-10",
        "tipo": "plastico",
        "cantidad": 9,
        "pesoKg": 3.1
      }
    ]
  },
  "error": null
}
```

Los períodos se agrupan por mes en formato `YYYY-MM`.

### 5.4 Desactivar usuario

```http
DELETE /usuarios/2
Authorization: Bearer <token>
```

**Recibe:** `id` como id positivo del usuario en la ruta. No requiere body.

**Devuelve:** el usuario desactivado, sin la contraseña.

## 6. Premios

### 6.1 Listar premios

```http
GET /premios
Authorization: Bearer <token>
```

**Recibe:** no requiere body ni parámetros.

**Devuelve:** un arreglo de premios con los campos del modelo, por ejemplo `id_premio`, `nombre`, `descripcion`, `costo` y `stock`.

### 6.2 Crear premio

```http
POST /premios
Authorization: Bearer <token>
```

**Recibe** en el body:

```json
{
  "nombre": "Cuaderno reciclado",
  "descripcion": "Cuaderno elaborado con papel reciclado",
  "costo": 50,
  "stock": 20
}
```

`nombre` y `descripcion` deben contener texto; `costo` debe ser mayor que cero; `stock` debe ser un entero igual o mayor que cero.

**Devuelve** HTTP 201: el premio creado con su id.

### 6.3 Canjear premio

```http
POST /premios/1/canjear
Authorization: Bearer <token>
```

**Recibe:** el id del premio en la ruta. No requiere body.

**Devuelve:** información del canje, del premio y los puntos restantes:

```json
{
  "ok": true,
  "data": {
    "canje": {
      "id_usuario_premio": 3,
      "fecha_obtencion": "2026-10-17",
      "id_premio": 1,
      "id_user": 1
    },
    "premio": {
      "id_premio": 1,
      "nombre": "Cuaderno reciclado",
      "costo": 50,
      "stock": 19
    },
    "puntos_restantes": 100.5
  },
  "error": null
}
```

## 7. Logros

### 7.1 Consultar logros del usuario

```http
GET /logros
Authorization: Bearer <token>
```

**Recibe:** no requiere body ni parámetros.

**Devuelve:** arreglo de logros obtenidos por el usuario, incluyendo los campos del logro y la fecha de obtención.

### 7.2 Crear logro

```http
POST /logros
Authorization: Bearer <token>
```

**Recibe** en el body:

```json
{
  "id_logro": 4,
  "nombre": "Reciclador frecuente",
  "tipo_condicion": "cantidad_residuos",
  "valor_objetivo": 10
}
```

`tipo_condicion` admite `cantidad_residuos`, `puntos_acumulados` o `peso_total_kg`; el id debe ser positivo, el nombre no vacío y el objetivo mayor a cero.

**Devuelve** HTTP 201: el objeto de logro creado.

## 8. Ranking

```http
GET /ranking
Authorization: Bearer <token>
```

**Recibe:** no requiere body ni parámetros.

**Devuelve** el top de usuarios, el total y la posición del usuario actual:

```json
{
  "ok": true,
  "data": {
    "top": [
      {
        "id_user": 2,
        "nombre": "María Gómez",
        "puntos": 320,
        "posicion": 1
      }
    ],
    "total_usuarios": 120,
    "usuario": {
      "id_user": 1,
      "nombre": "Carlos Pérez",
      "puntos": 150.5,
      "posicion": 2
    }
  },
  "error": null
}
```

El top contiene hasta diez usuarios. Cada usuario del ranking contiene `id_user`, `nombre`, `puntos` y `posicion`.

## 9. Notificaciones

### 9.1 Consultar notificaciones propias

```http
GET /notificaciones
Authorization: Bearer <token>
```

**Recibe:** no requiere body ni parámetros.

**Devuelve:** arreglo de notificaciones del usuario, ordenadas por fecha descendente. Cada elemento contiene los campos almacenados por el modelo de notificación, por ejemplo:

```json
{
  "id_notificacion": 5,
  "id_user": 1,
  "tipo": "reciclaje",
  "titulo": "Reciclaje registrado",
  "mensaje": "Registraste 0.25 kg de plastico y ganaste 2.5 puntos.",
  "fecha": "2026-10-17T20:00:00.000Z",
  "leida": false
}
```

### 9.2 Crear notificación del sistema

```http
POST /notificaciones/sistema
Authorization: Bearer <token>
```

**Recibe** en el body:

```json
{
  "id_user": 2,
  "titulo": "Aviso importante",
  "mensaje": "La aplicación tendrá mantenimiento esta noche."
}
```

`id_user` debe ser un entero positivo de un usuario existente; `titulo` y `mensaje` son obligatorios y no vacíos.

**Devuelve** HTTP 201: el registro de notificación creado, incluyendo id, usuario, tipo `sistema`, título, mensaje, fecha y estado `leida`.

## 10. Respuestas de error

Cuando una solicitud no puede procesarse, el backend devuelve un código HTTP de error y un objeto JSON. Según la ruta, el texto puede encontrarse en `mensaje`:

```json
{
  "ok": false,
  "data": null,
  "mensaje": "Descripción del error"
}
```

Códigos usados por la API:

| HTTP | Situación habitual |
|---:|---|
| `400` | Falta un campo requerido o su valor no cumple el formato esperado. |
| `401` | No se proporcionó una identidad válida o las credenciales no coinciden. |
| `403` | La operación requiere un rol diferente. |
| `404` | No existe el usuario, tacho, premio o recurso solicitado. |
| `409` | El recurso ya existe, se repitió la clave de idempotencia o no hay stock. |
| `500` | Error interno al procesar la solicitud. |
