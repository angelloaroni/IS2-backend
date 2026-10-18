# Arquitectura, conexiones y seguridad del backend

Documento de referencia para el backend de **Tachín Verde**. Describe los flujos implementados en el código del proyecto, la configuración que requieren y las medidas de seguridad que se deben tener en cuenta al probarlo o desplegarlo.

> Este documento describe el estado actual del código. No sustituye una revisión de seguridad del entorno de despliegue ni afirma que el sistema esté libre de vulnerabilidades.

## 1. Tecnologías y estructura

- **Node.js con módulos ES** (`"type": "module"` en `package.json`).
- **Express** para HTTP y montaje de rutas.
- **PostgreSQL** como base de datos.
- **Sequelize** como ORM, además de consultas SQL parametrizadas para métricas.
- **bcryptjs** para almacenar contraseñas mediante hash.
- **jsonwebtoken** para crear y verificar tokens JWT.
- **EventEmitter** para ejecutar tareas relacionadas después de registrar reciclajes, otorgar logros o canjear premios.

El flujo habitual de una petición es:

```text
Cliente o dispositivo
  -> Express (src/app.js)
  -> rutas (src/routes/)
  -> middleware de autenticación/autorización, si corresponde
  -> controlador (src/controllers/)
  -> servicio y validación de reglas (src/services/)
  -> repositorio / Sequelize / PostgreSQL
  -> respuesta JSON
```

Las rutas API se montan bajo `/api`. Por ejemplo, el inicio de sesión es `POST /api/auth/login`.

## 2. Conexión a PostgreSQL

La conexión se crea en `src/config/db.js`.

### Configuración local

Si `DATABASE_URL` está vacío, el backend usa estas variables:

```dotenv
DATABASE_URL=
DB_NAME=nombre_de_la_base
DB_USER=usuario_de_postgres
DB_PASSWORD=contraseña_de_postgres
DB_HOST=localhost
DB_PORT=5432
```

`DATABASE_URL` vacío es válido para el modo local. **No dejes vacíos** los valores de `DB_NAME`, `DB_USER` y `DB_PASSWORD` si la base requiere credenciales.

### Configuración con URL

Si `DATABASE_URL` tiene un valor, Sequelize usa esa URL en lugar de las variables individuales. Esa rama de la configuración activa TLS, pero actualmente establece `rejectUnauthorized: false`; por lo tanto, no valida la autoridad del certificado del servidor. Para producción remota, configura la CA y la verificación de certificado de acuerdo con el proveedor de PostgreSQL.

La definición de las tablas está en `database/schema.sql`; existe una migración SQL para notificaciones en `database/migrations/`. Los modelos declaran cómo se corresponden los atributos JavaScript con las tablas. Por ejemplo, el atributo `contraseña` del modelo `Usuario` corresponde a la columna PostgreSQL `contrasena`.

## 3. Registro, contraseña y JWT

### Registro: `POST /api/auth/registro`

El servicio:

1. Valida que `cod_user` tenga exactamente ocho dígitos y que el nombre, tipo y contraseña no estén vacíos.
2. Solo permite registrar públicamente cuentas con `tipo: "usuario"`. Un cliente no puede crear una cuenta `admin` enviando ese rol.
3. Rechaza contraseñas de más de 72 bytes en UTF-8.
4. Genera un hash bcrypt con 12 rondas y guarda ese hash en la columna `contrasena`.
5. Inicializa `puntos` en 0 y `estado` en `true`.
6. Devuelve el usuario sin el atributo de contraseña.

La contraseña **no se cifra para poder descifrarla**: se almacena mediante un hash unidireccional bcrypt. Al iniciar sesión se compara la contraseña enviada con ese hash. El límite de 72 bytes corresponde a la entrada máxima definida por este backend para bcrypt; no implica que exista una política de complejidad o un mínimo de caracteres más allá de que no esté vacía.

### Transición de cuentas antiguas

Si una cuenta existente tiene una contraseña almacenada como texto plano, el login compara la contraseña de forma segura en tiempo constante. Si coincide y la cuenta está activa, el servicio reemplaza ese valor por un hash bcrypt. La transición ocurre **al iniciar sesión correctamente**; no se migran todas las cuentas en lote.

### Inicio de sesión: `POST /api/auth/login`

El login valida el código y la contraseña, busca el usuario, rechaza credenciales incorrectas y cuentas inactivas, y responde con:

```json
{
  "ok": true,
  "data": {
    "usuario": {
      "id_user": 11,
      "cod_user": "00000011",
      "nombre": "Nombre",
      "puntos": 0,
      "tipo": "usuario",
      "estado": true
    },
    "token": "<jwt-firmado>"
  },
  "error": null
}
```

El usuario de la respuesta no incluye la contraseña ni el hash.

### Emisión y validación de JWT

- Algoritmo de firma: **HS256**.
- El sujeto `sub` contiene el `id_user`; también se incluyen emisor (`iss`), audiencia (`aud`), fecha de emisión y expiración.
- Emisor y audiencia esperados por el backend: `is2-backend` e `is2-api`.
- La duración usa `JWT_EXPIRES_IN`; si no se define, el código usa `1d`.
- `JWT_SECRET` debe estar configurado y contener como mínimo 32 bytes. La aplicación devuelve un error de configuración si falta o es demasiado corto.

Para generar una clave aleatoria en PowerShell:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
```

Guarda el resultado en el `.env` local:

```dotenv
JWT_SECRET=pega_aqui_el_valor_generado
JWT_EXPIRES_IN=1d
```

No uses un valor de ejemplo ni publiques la clave. El archivo `.env` está excluido por `.gitignore`; no se deben subir secretos al repositorio. Cambiar `JWT_SECRET` invalida los tokens previamente emitidos.

### Uso del token

Para cada ruta de usuario protegida, envía el JWT en:

```http
Authorization: Bearer <token>
```

El middleware verifica la firma, el algoritmo, emisor, audiencia, expiración y el `sub`. Después vuelve a consultar el usuario en PostgreSQL. Por eso, una cuenta inexistente o inactiva no puede continuar aunque el token tenga una firma válida; el rol vigente también se obtiene de la base de datos y no se confía en un rol enviado por el cliente.

El antiguo header `x-cod-user` **no autentica** las rutas de usuario. El código de usuario solo identifica una cuenta y no prueba la identidad de quien hace la petición.

## 4. Autorización por rol y respuestas HTTP

Autenticación responde a “¿quién es el usuario?”; autorización responde a “¿puede ese usuario ejecutar esta operación?”. El middleware `authorizeRoles` aplica el segundo control después de verificar el JWT.

- Sin `Authorization: Bearer ...`, token inválido o vencido: `401`.
- Usuario válido sin el rol necesario: `403`.
- El registro público no admite el rol `admin`.
- Las operaciones administrativas de tachos, premios, logros, notificaciones del sistema y baja de usuarios requieren `admin`.
- Leer recursos generales de la API requiere JWT de usuario activo; varias rutas admiten `admin` y `usuario`.

El código HTTP y la respuesta JSON son la referencia final. Las respuestas exitosas usan la forma:

```json
{ "ok": true, "data": {}, "error": null }
```

El helper de errores devuelve:

```json
{ "ok": false, "data": null, "mensaje": "Descripción del error" }
```

## 5. Registro de residuos, puntos e idempotencia

El cliente autenticado puede usar `POST /api/residuos` (también hay rutas alternativas bajo `/api/residuo`). El servidor toma el `id_user` del usuario autenticado: no debe confiar en un `idUser` que envíe el cliente.

### Validaciones del registro

- `idUser` e `idTacho` deben ser enteros positivos.
- El peso debe ser finito y mayor que cero.
- Los únicos tipos aceptados son `plastico`, `papel/carton` y `organicos`. Se normalizan mayúsculas, espacios exteriores y acentos antes de validarlos.
- Se requiere `idempotencyKey`, texto no vacío de hasta 128 caracteres.
- El usuario debe estar activo y el tacho debe existir y estar activo.

### Fórmula de puntos

Las tarifas actuales son 10 puntos por kilogramo para cada material:

| Tipo | Tarifa |
|---|---:|
| `plastico` | 10 puntos/kg |
| `papel/carton` | 10 puntos/kg |
| `organicos` | 10 puntos/kg |

```text
puntosGanados = pesoEnKilogramos × tarifaDelTipo
```

Ejemplo: `0.25 kg × 10 puntos/kg = 2.5 puntos`. El código no redondea el resultado.

El registro del residuo, el historial y la suma de puntos se ejecutan dentro de una transacción de base de datos. Si una parte falla, se revierte la transacción. La clave de idempotencia también tiene restricción única: reutilizarla produce `409` y no vuelve a crear el residuo ni a sumar puntos.

Después del commit se emite el evento `residuo.registrado`. Sus consumidores intentan actualizar logros, ranking y notificaciones. Esas tareas son posteriores y asíncronas respecto a la transacción del residuo; un fallo de un consumidor se registra en el log y no revierte el reciclaje ya confirmado.

> El endpoint de cliente utiliza el peso enviado en la petición. La validación actual impide valores no finitos o no positivos, pero no fija un máximo de peso. Los puntos son tan confiables como la fuente que verifica esa medición.

## 6. Recepción del tacho inteligente

El backend se suscribe al broker Mosquitto al iniciar. La conexión y los dos temas se configuran mediante:

```dotenv
MQTT_BROKER_URL=mqtt://192.168.18.143:1883
MQTT_TOPIC_TACHO_ESTADO=smartbin/status
MQTT_TOPIC_EVENTO_RECICLAJE=smartbin/recycle
MQTT_USERNAME=
MQTT_PASSWORD=
```

El usuario y la contraseña son opcionales, pero deben configurarse juntos. Protege el broker con autenticación y ACL para limitar qué dispositivos pueden publicar en estos temas; en redes no confiables, usa MQTT sobre TLS (`mqtts://`).

El tema `smartbin/status` recibe el identificador, coordenadas y capacidad del tacho:

```json
{
  "idTacho": 1,
  "latitud": -12.0464,
  "longitud": -77.0428,
  "capacidad": true
}
```

El tacho debe existir y estar activo. El mensaje actualiza `latitud`, `longitud` y `capacidad` en la tabla `TachoInteligente`, pero no su estado administrativo (`estado`), utilizado para habilitarlo o darlo de baja.

El tema `smartbin/recycle` recibe exclusivamente:

```json
{
  "idEvento": "identificador-unico",
  "codUser": "00001001",
  "idTacho": 1,
  "tipo": "papel/carton",
  "peso": 0.5
}
```

`idEvento` es obligatorio y se usa como clave de idempotencia; `codUser` debe contener ocho dígitos; el usuario y el tacho deben estar activos. El servidor resuelve el usuario, genera la fecha y calcula los puntos. No se admiten campos adicionales en este mensaje. MQTT QoS 1 permite la entrega al menos una vez; un `idEvento` repetido no vuelve a registrar el residuo ni sumar puntos.

## 7. Otras reglas de negocio y fórmulas

### Métricas e historial

- `GET /api/usuarios/me/historial` consulta el historial del usuario autenticado. Usa `pagina` y `limite`; los valores predeterminados son 1 y 10, y el máximo de `limite` es 100.
- El desplazamiento de página se calcula como:

  ```text
  offset = (pagina - 1) × limite
  ```

- `GET /api/usuarios/me/metricas` calcula los totales para el usuario autenticado: cantidad de residuos, peso total, agrupación por tipo, por mes y por tipo/mes. Las consultas agregan datos del historial y residuos y formatean el periodo mensual como `YYYY-MM`.
- En estas consultas el peso total se calcula con `SUM(peso)`; se asume que cada residuo tiene su registro correspondiente en el historial.

### Logros

Los tipos de condición soportados son:

- `cantidad_residuos`
- `puntos_acumulados`
- `peso_total_kg`

Un logro se otorga cuando:

```text
progresoDelUsuario >= valor_objetivo
```

El servicio evita volver a otorgar un logro ya registrado para ese usuario. La evaluación se dispara después del evento de registro de residuo.

### Canje de premios

El canje verifica en una transacción que el usuario esté activo, que el premio exista y tenga stock, y que el usuario tenga puntos suficientes. En caso de éxito:

```text
puntosRestantes = puntosAntesDelCanje − costoDelPremio
stockRestante   = stockAnterior − 1
```

El usuario y el premio se bloquean para evitar que canjes concurrentes gasten los mismos puntos o la última unidad de stock más de una vez. Si falla una validación o escritura, la transacción se revierte.

### Ranking

El ranking considera usuarios activos y los ordena por puntos descendentes; en empate usa `id_user` ascendente. La respuesta incluye los primeros 10, el total de usuarios y la posición del usuario consultante si está en el ranking.

### Tachos cercanos

La búsqueda usa un rectángulo geográfico para reducir candidatos y luego filtra y ordena por distancia exacta usando la fórmula de Haversine:

```text
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
d = 2 × R × asin(√a)
```

Los ángulos se convierten a radianes y `R = 6 371 000 m`. El radio predeterminado es 5000 m y el máximo aceptado es 50 000 m. La respuesta redondea la distancia a metros enteros.

## 8. Rutas principales y autenticación

Todas las rutas siguientes están bajo el prefijo `/api`.

| Rutas | Acceso / propósito |
|---|---|
| `POST /auth/registro` | Público; solo registra `usuario`. |
| `POST /auth/login` | Público; valida credenciales y devuelve JWT. |
| `/usuarios`, `/residuos`, `/residuo`, `/premios`, `/ranking`, `/logros`, `/notificaciones` | Requieren JWT y usuario activo; cada operación puede aplicar autorización adicional por rol. |
| `GET /tachos`, `GET /tachos/cercanos`, `GET /tachos/:id` | Requieren JWT. |
| `POST /tachos`, `PUT /tachos/:id`, `DELETE /tachos/:id` | Requieren JWT con rol `admin`. |
| `MQTT_TOPIC_TACHO_ESTADO` | Actualiza la capacidad de un tacho a partir del JSON MQTT. |
| `MQTT_TOPIC_EVENTO_RECICLAJE` | Registra el reciclaje indicado en el JSON MQTT; el backend se suscribe al iniciar. |

Las rutas concretas y su implementación se encuentran en `src/routes/` y `src/controllers/`.

## 9. Reglas y recomendaciones de seguridad

### Ya implementado

- Hash bcrypt para nuevas contraseñas, comparación de hashes y migración gradual de contraseñas antiguas en login exitoso.
- JWT firmado, con algoritmo permitido, expiración, emisor y audiencia validados.
- Búsqueda del usuario actual en base de datos por cada petición autenticada; verificación de estado activo.
- Autorización por roles en operaciones administrativas.
- Registro público limitado al rol `usuario`.
- No se serializan contraseñas en las respuestas de autenticación.
- Consultas de métricas con reemplazos parametrizados de Sequelize.
- Transacciones para registro de residuos y canjes; restricción única para idempotencia.
- `.env` excluido por `.gitignore`.

### Importante para el despliegue y puntos que no cubre el código

- **Usa HTTPS** en cualquier entorno accesible por una red. `index.js` inicia Express sin configurar TLS por sí mismo; HTTPS debe garantizarlo un proxy/ingress bien configurado u otra capa de transporte.
- `cors()` está habilitado sin una lista de orígenes explícita. En producción, limita los orígenes a las aplicaciones frontend permitidas.
- No se observa middleware de limitación de intentos para login/registro. Considera rate limiting y monitoreo contra intentos automatizados.
- El registro solo exige contraseña no vacía y respeta el límite de 72 bytes; no aplica longitud mínima ni comprobación de contraseñas comunes.
- El cliente puede declarar el peso en el endpoint de residuos. Para conceder puntos reales, valida la medición desde una fuente confiable y define límites físicos/de negocio en el servidor.
- La verificación TLS de PostgreSQL en la rama `DATABASE_URL` está desactivada (`rejectUnauthorized: false`). No uses esa configuración como garantía de identidad del servidor en conexiones remotas.
- La autenticación y los permisos de publicación dependen de la configuración del broker MQTT; habilita credenciales, ACL y TLS cuando corresponda.
- No se implementa refresh token ni endpoint de logout/revocación individual. La rotación de `JWT_SECRET` invalida todos los tokens, pero también cierra las sesiones legítimas.
- Evita poner contraseñas, `JWT_SECRET`, tokens, credenciales MQTT o de PostgreSQL en capturas, chats, tickets, logs o control de versiones.

## 10. Probar el comportamiento

Desde la raíz del proyecto:

```powershell
npm install
npm test
npm start
```

`npm test` ejecuta las pruebas automatizadas con `node:test`. Para la prueba manual, abre `http/auth-tests.http` en VS Code con la extensión REST Client:

1. Ejecuta `POST /auth/registro` para crear un usuario.
2. Ejecuta `POST /auth/login` con sus credenciales y copia `data.token` **solo en el editor local**.
3. Sustituye `@userToken` en el archivo `.http` por ese JWT y ejecuta `GET /usuarios`.
4. La petición de administrador con un token de usuario debe dar `403`; un token inválido debe dar `401`.
5. No publiques el token en capturas ni en conversaciones. Si un token real se expone, rota `JWT_SECRET` y reinicia el backend.

Las pruebas automatizadas disponibles comprueban hash/verificación de contraseñas, validación y firma JWT, autenticación con usuario activo y rechazo del header anterior `x-cod-user`.
