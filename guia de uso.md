# Guía de uso de la API — Tachín Verde

Referencia para consumir las APIs HTTP del backend y los mensajes MQTT que procesan los tachos inteligentes. El documento refleja el estado actual del código del repositorio y debe usarse como guía operativa para probar, integrar y mantener la API.

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

En la tabla de cada endpoint, los campos indicados como `recibe` describen el body, query string, ruta o header. `devuelve` describe el objeto dentro de `data`.

En las rutas protegidas, primero inicia sesión y envía el JWT de la respuesta en el encabezado:

```http
Authorization: Bearer <jwt>
```

### Roles y permisos

- Rutas públicas: solicitud y verificación de códigos, `POST /auth/registro`, `POST /auth/recuperar-contrasena`, `POST /auth/modificar-contrasena` y `POST /auth/login`.
- Rutas para usuarios autenticados: perfil, historial, métricas, residuos, ranking, logros, premios y notificaciones personales.
- Rutas administrativas: creación, edición y baja de tachos, creación de premios y logros, envío de notificaciones del sistema y baja de usuarios.
- El header `x-cod-user` no autentica ninguna ruta; la identidad real se valida desde el JWT y la base de datos.

Configura `JWT_SECRET` en el entorno del servidor con al menos 32 bytes aleatorios. Las contraseñas se guardan con hash bcrypt; las contraseñas antiguas en texto plano se convierten a hash al iniciar sesión correctamente.

El registro público solo permite crear cuentas de tipo `usuario`. Las cuentas `admin` deben provisionarse por un proceso administrativo confiable (por ejemplo, promoviendo una cuenta desde un proceso con acceso controlado a la base de datos), nunca enviando `"tipo": "admin"` al registro.

## 1. Registro e inicio de sesión

### 1.1 Verificar correo y registrar usuario

Antes de registrar la cuenta, solicita un código de verificación:

```http
POST /auth/registro/codigo
```

**Recibe** en el body:

```json
{
  "correo_institucional": "ana@institucion.edu"
}
```

El sistema envía un código aleatorio de 8 dígitos al correo. El código expira en 3 minutos y admite hasta 5 intentos. Para volver a solicitarlo hay que esperar 1 minuto.

**Devuelve** HTTP 200:

```json
{
  "ok": true,
  "data": {
    "mensaje": "Se envió un código de verificación al correo institucional."
  },
  "error": null
}
```

Verifica el código recibido:

```http
POST /auth/verificar-codigo
```

```json
{
  "correo_institucional": "ana@institucion.edu",
  "codigo_verificacion": "01234567",
  "proposito": "registro"
}
```

`proposito` debe ser `registro`. Si el código es correcto, devuelve un token de seguridad de un solo uso, válido por 10 minutos:

```json
{
  "ok": true,
  "data": {
    "mensaje": "Código verificado correctamente",
    "token_seguridad": "<token-de-un-solo-uso>",
    "expira_en_segundos": 600
  },
  "error": null
}
```

Completa el registro usando el token obtenido:

```http
POST /auth/registro
```

```json
{
  "cod_user": "00001004",
  "nombre": "Ana Pérez",
  "tipo": "usuario",
  "contraseña": "mi-clave",
  "correo_institucional": "ana@institucion.edu",
  "token_seguridad": "<token-de-un-solo-uso>"
}
```

`cod_user` debe tener ocho dígitos y ser único; `nombre` no puede estar vacío; `tipo` debe ser `usuario`; la contraseña es obligatoria y de hasta 72 bytes UTF-8. El correo debe ser el mismo que se verificó. El token se consume al crear la cuenta. El servidor inicializa `puntos` en `0` y `estado` en `true`, y nunca devuelve la contraseña.

**Devuelve** HTTP 201 con el usuario creado, incluido el correo institucional y sin la contraseña:

```json
{
  "ok": true,
  "data": {
    "id_user": 4,
    "cod_user": "00001004",
    "nombre": "Ana Pérez",
    "puntos": 0,
    "tipo": "usuario",
    "correo_institucional": "ana@institucion.edu",
    "estado": true
  },
  "error": null
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
    "correo_institucional": "carlos@institucion.edu",
    "estado": true
  },
  "token": "<jwt-firmado>"
}
```

### 1.3 Recuperar la cuenta y cambiar la contraseña

Solicita el código de recuperación con el correo institucional:

```http
POST /auth/recuperar-contrasena
```

```json
{
  "correo_institucional": "ana@institucion.edu"
}
```

La respuesta no revela si existe una cuenta asociada al correo. Si corresponde a una cuenta activa, se envía un código de 8 dígitos, válido por 3 minutos y con un máximo de 5 intentos.

**Devuelve** HTTP 200 con el mismo mensaje para una cuenta existente o inexistente:

```json
{
  "ok": true,
  "data": {
    "mensaje": "Si el correo está asociado a una cuenta, recibirás un código de verificación."
  },
  "error": null
}
```

Verifica el código con propósito `recuperacion`:

```http
POST /auth/verificar-codigo
```

```json
{
  "correo_institucional": "ana@institucion.edu",
  "codigo_verificacion": "01234567",
  "proposito": "recuperacion"
}
```

Con el token de seguridad devuelto, solicita el cambio:

```http
POST /auth/modificar-contrasena
```

```json
{
  "cod_user": "00001004",
  "nueva_contraseña": "nueva-clave-segura",
  "token_seguridad": "<token-de-un-solo-uso>"
}
```

El backend comprueba que el token no esté vencido ni usado y que el usuario indicado por `cod_user` sea el dueño del correo que recibió el código. El token se invalida al cambiar la contraseña. La nueva contraseña se almacena con bcrypt y acepta hasta 72 bytes UTF-8.

## 2. Residuos y reciclaje

### 2.1 Registrar un residuo desde cliente

Endpoint recomendado:

```http
POST /residuos
Authorization: Bearer <jwt>
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

El backend se suscribe al broker Mosquitto al iniciar. La conexión y los temas se configuran en variables de entorno y pueden sobrescribirse por entorno; el cliente MQTT usa QoS 1.

```dotenv
MQTT_BROKER_URL=mqtt://0.tcp.sa.ngrok.io:12467
MQTT_TOPIC_TACHO_ESTADO=smartbin/status
MQTT_TOPIC_EVENTO_RECICLAJE=smartbin/recycle
MQTT_USERNAME=
MQTT_PASSWORD=
```

Usa la URL del broker asignada a tu entorno; la anterior es el valor de ejemplo. El usuario y la contraseña son opcionales, pero deben configurarse juntos. El backend valida que `MQTT_USERNAME` y `MQTT_PASSWORD` no queden mezclados: si uno está definido, el otro también debe estarlo. Los temas de estado y reciclaje no pueden ser iguales.

### 3.1 Tema `smartbin/status`

El dispositivo publica un objeto JSON con todos estos campos:

```json
{
  "id_tacho": 1,
  "tipo": "plastico",
  "latitud": -12.0464,
  "longitud": -77.0428,
  "capacidad": true,
  "porcentaje": 100
}
```

`id_tacho` debe ser un entero positivo; `tipo` texto de 1 a 32 caracteres; latitud y longitud deben estar dentro de sus rangos geográficos; `capacidad` debe ser booleano y `porcentaje` un número entre 0 y 100. El backend actualiza esos datos del tacho activo en la tabla `TachoInteligente`. `porcentaje` se guarda numéricamente en una escala de 0 a 100.

`capacidad: true` indica que el dispositivo reporta el tacho lleno. Este mensaje no cambia el estado administrativo del tacho (`estado`). El backend persiste el estado recibido; **no envía alertas por correo** cuando el tacho se llena.

### 3.2 Tema `smartbin/recycle`

El dispositivo publica un objeto JSON con este formato:

```json
{
  "idtacho": 1,
  "evento": "tacho-1-event-000045",
  "codUser": "00001001",
  "tipo": "papel/carton",
  "peso": 0.5
}
```

`evento` debe ser un identificador único por reciclaje; el backend lo guarda como clave de idempotencia. `codUser` debe tener ocho dígitos. El backend normaliza `idtacho` al identificador interno, resuelve el usuario por `codUser`, verifica que usuario y tacho estén activos, calcula puntos y registra el residuo en la misma transacción.

Si el mismo `evento` llega más de una vez (por ejemplo por QoS 1), no se vuelve a insertar el residuo ni a sumar puntos. La ruta HTTP antigua `POST /api/tachos/recepcion` ya no está disponible; el flujo MQTT reemplaza ese mecanismo.

## 4. Tachos

Las respuestas serializadas de tacho contienen `idTacho`, `tipo`, `latitud`, `longitud`, `capacidad` y `porcentaje`. En tachos existentes que aún no hayan recibido los campos nuevos de estado, `tipo` y `porcentaje` pueden ser `null`.

Los usuarios autenticados pueden consultar el listado, buscar por id y buscar cercanos. La creación, edición y baja de tachos requieren rol `admin`.

### 4.1 Listar tachos activos

```http
GET /tachos
Authorization: Bearer <jwt>
```

**Recibe:** no requiere body ni parámetros.

**Devuelve** un arreglo de tachos:

```json
{
  "ok": true,
  "data": [
    {
      "idTacho": 1,
      "tipo": "plastico",
      "latitud": -12.0464,
      "longitud": -77.0428,
      "capacidad": false,
      "porcentaje": 25
    }
  ],
  "error": null
}
```

### 4.2 Obtener tacho por id

```http
GET /tachos/1
Authorization: Bearer <jwt>
```

**Recibe:** `id` como entero positivo en la ruta.

**Devuelve:** un objeto de tacho con `idTacho`, `tipo`, `latitud`, `longitud`, `capacidad` y `porcentaje`.

### 4.3 Buscar tachos cercanos

```http
GET /tachos/cercanos?lat=-12.0464&lng=-77.0428&radio=5000
Authorization: Bearer <jwt>
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
      "tipo": "plastico",
      "latitud": -12.0464,
      "longitud": -77.0428,
      "capacidad": false,
      "porcentaje": 25,
      "distanciaM": 0
    }
  ],
  "error": null
}
```

### 4.4 Agregar tacho

```http
POST /tachos
Authorization: Bearer <jwt>
```

**Recibe** en el body:

```json
{
  "tipo": "plastico",
  "latitud": -12.0464,
  "longitud": -77.0428,
  "capacidad": false,
  "porcentaje": 0
}
```

`tipo` y `porcentaje` son opcionales en las operaciones administrativas. Si se envía `porcentaje`, debe estar entre 0 y 100. Latitud debe estar entre -90 y 90, longitud entre -180 y 180, y `capacidad` debe ser `true` o `false`.

**Devuelve** HTTP 201: el tacho creado, incluyendo el `idTacho` asignado.

### 4.5 Editar tacho

```http
PUT /tachos/1
Authorization: Bearer <jwt>
```

**Recibe** en el body uno o varios de estos campos:

```json
{
  "latitud": -12.047,
  "longitud": -77.041,
  "capacidad": true,
  "porcentaje": 80
}
```

`tipo`, `latitud`, `longitud`, `capacidad` y `porcentaje` son opcionales individualmente, pero se debe enviar al menos uno. No se admiten campos adicionales.

**Devuelve:** el tacho actualizado con `idTacho`, `tipo`, `latitud`, `longitud`, `capacidad` y `porcentaje`.

### 4.6 Dar de baja tacho

```http
DELETE /tachos/1
Authorization: Bearer <jwt>
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
Authorization: Bearer <jwt>
```

**Recibe:** no requiere body ni parámetros.

**Devuelve:** el objeto del usuario autenticado por el JWT, sin contraseña. Los campos corresponden a los atributos del modelo del usuario.

### 5.2 Consultar historial propio

```http
GET /usuarios/me/historial?pagina=1&limite=10
Authorization: Bearer <jwt>
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
Authorization: Bearer <jwt>
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
Authorization: Bearer <jwt>
```

**Recibe:** `id` como id positivo del usuario en la ruta. No requiere body.

**Devuelve:** el usuario desactivado, sin la contraseña.

## 6. Premios

### 6.1 Listar premios

```http
GET /premios
Authorization: Bearer <jwt>
```

**Recibe:** no requiere body ni parámetros.

**Devuelve:** un arreglo de premios con los campos del modelo, por ejemplo `id_premio`, `nombre`, `descripcion`, `costo` y `stock`.

### 6.2 Crear premio

```http
POST /premios
Authorization: Bearer <jwt>
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
Authorization: Bearer <jwt>
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
Authorization: Bearer <jwt>
```

**Recibe:** no requiere body ni parámetros.

**Devuelve:** arreglo de logros obtenidos por el usuario, incluyendo los campos del logro y la fecha de obtención.

### 7.2 Crear logro

```http
POST /logros
Authorization: Bearer <jwt>
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
Authorization: Bearer <jwt>
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
Authorization: Bearer <jwt>
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
Authorization: Bearer <jwt>
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
| `429` | Se solicitó otro código antes de que transcurriera el intervalo de reenvío. |
| `502` / `503` | Falló el envío del correo o SMTP no está configurado. |
| `500` | Error interno al procesar la solicitud. |

## 11. Configuración y comprobación rápida

- En local, crea un archivo `.env` a partir de `.env.example` y completa `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `JWT_SECRET` y `VERIFICATION_SECRET`. Ambos secretos deben tener al menos 32 bytes aleatorios.
- Genera cada secreto de forma independiente, por ejemplo con `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"`; no reutilices ni publiques los valores.
- Para Google Workspace o Gmail, configura el transporte SMTP así:

  ```dotenv
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_SECURE=false
  SMTP_USER=cuenta-institucional@institucion.edu
  SMTP_PASSWORD=contraseña_de_aplicacion_de_google
  SMTP_FROM=cuenta-institucional@institucion.edu
  ```

  `SMTP_USER` debe ser la dirección completa de la cuenta Google que autentica el envío, sin espacios ni texto adicional. `SMTP_FROM` debe ser esa dirección autorizada. `SMTP_PASSWORD` debe ser una contraseña de aplicación de Google, no la contraseña habitual; si Google la muestra agrupada, introdúcela sin espacios. No incluyas comillas en los valores ni publiques el contenido de `.env`.
- Para generar una contraseña de aplicación, inicia sesión con la cuenta que se usará como remitente, activa la verificación en dos pasos y crea una contraseña con un nombre reconocible, por ejemplo `Tachín Verde Backend`. Algunas cuentas institucionales tienen esta función bloqueada por políticas de Google Workspace; en ese caso, solicita al administrador de la institución el método de envío aprobado. Consulta la [ayuda oficial de Google sobre contraseñas de aplicación](https://support.google.com/accounts/answer/185833?hl=es).
- Si aparece `535-5.7.8 Username and Password not accepted`, comprueba que `SMTP_USER` sea el correo completo correcto, que la contraseña de aplicación se haya copiado sin espacios y que corresponda a esa misma cuenta. Verifica también que Google Workspace permita contraseñas de aplicación. Si la credencial se compartió o expuso, revócala en la cuenta Google y genera otra. `SMTP_USER` y `SMTP_PASSWORD` deben configurarse juntos; los códigos no se enviarán si falta SMTP o falla la autenticación.
- Después de cambiar el `.env`, reinicia el backend. El envío de los códigos de verificación requiere SMTP funcional.
- Ejecuta una vez cada migración pendiente en la base existente: `database/migrations/20261018_add_email_and_recovery_verification.sql` y `database/migrations/20261018_add_tacho_status_fields.sql`. La primera habilita correo/verificación de cuenta; la segunda agrega `tipo` y `porcentaje` al estado del tacho.
- Si se usa PostgreSQL con conexión por URL, `DATABASE_URL` puede reemplazar las variables locales; el backend usa esa URL cuando está definida.
- El backend crea la conexión MQTT al iniciar y loguea `Suscrito a temas MQTT: ...` cuando la suscripción tiene éxito.
- Para validar recepción real, publica un evento válido al tema `smartbin/status` o `smartbin/recycle` y revisa la base de datos o las respuestas de las rutas autenticadas.
- La API no tiene clientes de UI integrados en este repositorio; la integración debe hacerse con herramientas HTTP o un broker MQTT externo.
