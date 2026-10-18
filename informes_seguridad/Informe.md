# Informe de revisión de seguridad del backend

## Resumen ejecutivo

Se realizó una revisión estática del código del backend de Tachín Verde. Se identificaron **6 hallazgos: 2 de severidad alta y 4 de severidad media**. Dos de los hallazgos de severidad media dependen de la configuración y topología del despliegue, aspectos que no pueden confirmarse únicamente leyendo el código.

Los riesgos prioritarios son la posibilidad de crear cuentas administrativas mediante el registro público y la autenticación de usuarios basada únicamente en un código que envía el propio cliente. Juntos, estos problemas pueden permitir a un atacante acceder a funciones administrativas y actuar en nombre de otros usuarios.

## Alcance y método

La revisión se limitó al código disponible del backend: rutas, middleware, controladores, servicios, repositorios, modelos, configuración de base de datos e inicio de la aplicación. No se ejecutaron pruebas dinámicas, pruebas de penetración, escáneres de dependencias ni comandos de Git. No se verificó la configuración efectiva del entorno de despliegue.

Los hallazgos se ordenan de mayor a menor impacto. Las líneas indicadas corresponden a la revisión estática y pueden cambiar si se modifica el código.

## Hallazgos

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟠 HIGH | `src/routes/auth.routes.js`; `src/routes/index.routes.js`; `src/services/usuario.service.js` | 6; 17; 27-56 | El registro público acepta el campo `tipo` enviado por el cliente y lo persiste sin impedir el rol `admin`. Un atacante puede registrarse como administrador y utilizar rutas restringidas a ese rol. | 10/10 |
| 2 | 🟠 HIGH | `src/middlewares/auth.middleware.js`; `src/routes/index.routes.js` | 6-40; 19-27 | La autenticación de rutas protegidas confía en el header `x-cod-user`. El middleware comprueba que el código tenga ocho dígitos y que exista un usuario activo, pero no verifica contraseña, token, firma ni otro secreto. Quien conozca un código puede suplantar esa identidad. En combinación con el hallazgo 1, el riesgo puede incluir acceso administrativo. | 10/10 |
| 3 | 🟡 MEDIUM | `src/controllers/residuo.controller.js`; `src/services/puntos.service.js`; `src/formulas/calcularPuntos.js`; `src/services/residuo.service.js`; `src/routes/index.routes.js` | 9-14; 35-56; 8-20; 84-100; 20-21 | El endpoint de registro para usuarios recibe el peso del cliente y lo utiliza para calcular puntos. La validación exige un valor positivo y finito, pero no impone un máximo ni acredita que la medición proceda de un dispositivo confiable. Un usuario autenticado puede enviar pesos muy elevados y acumular puntos indebidamente. | 9/10 |
| 4 | 🟡 MEDIUM | `src/services/usuario.service.js`; `src/models/Usuario.js` | 31; 50-55; 89-90; 31-34 | El servicio guarda la contraseña recibida directamente y la compara como texto plano durante el login. Una exposición de la base de datos revelaría las contraseñas, que podrían reutilizarse para comprometer cuentas en otros sistemas. | 10/10 |
| 5 | 🟡 MEDIUM | `src/config/db.js` | 10-16 | La conexión configurada mediante `DATABASE_URL` requiere TLS, pero establece `rejectUnauthorized: false`. Esto desactiva la validación del certificado del servidor. Si la conexión es remota y un atacante puede interceptarla, el cliente podría aceptar un servidor de base de datos impostor. La explotabilidad depende del entorno. | 9/10 |
| 6 | 🟡 MEDIUM | `index.js` | 3-6 | El código inicia el servidor mediante HTTP y no configura TLS en el propio listener. Si se expone directamente a redes no confiables, sin un proxy confiable que termine TLS, las credenciales y la API key del tacho podrían interceptarse. La topología desplegada no se puede determinar desde el código. | 8/10 |

## Detalle y recomendaciones

### 1. Registro público con asignación de rol administrativo

**Impacto:** escalamiento de privilegios y acceso a operaciones administrativas.

El registro es público y el servicio de creación de usuario acepta y persiste el valor de `tipo` recibido. Las rutas administrativas usan ese rol para autorizar operaciones.

**Recomendación:** asignar un rol ordinario fijo en el flujo público de registro. La creación o asignación del rol `admin` debe quedar en un flujo separado, autenticado y autorizado para personal administrador o en un proceso controlado de provisión inicial. No confiar en el rol enviado por el cliente.

### 2. Autenticación basada en un código público o predecible

**Impacto:** suplantación de usuarios y acceso no autorizado a los datos y operaciones de las rutas protegidas.

El header `x-cod-user` identifica a la cuenta, pero no prueba que quien lo envía sea su titular.

**Recomendación:** validar credenciales durante el login y emitir una sesión o token firmado, con expiración y validación en middleware. El identificador del usuario debe derivarse de claims verificados, no de un valor que el cliente pueda declarar libremente. Mantener controles de roles independientes de la autenticación.

### 3. Manipulación del peso para obtener puntos

**Impacto:** fraude de puntos y eventual canje indebido de premios.

El cálculo es lineal en función del peso enviado. La protección por idempotencia impide reutilizar el mismo identificador, pero no impide que un usuario mande un peso artificialmente alto con una clave nueva.

**Recomendación:** no conceder puntos basándose únicamente en el peso enviado por el frontend. Priorizar el flujo autenticado de dispositivos confiables, validar que la medición corresponda a un tacho autorizado y aplicar límites de negocio definidos con el equipo. La medición y los puntos deben determinarse o verificarse en el servidor.

### 4. Contraseñas en texto plano

**Impacto:** exposición inmediata de contraseñas en caso de fuga, copia o acceso indebido a la base de datos.

**Recomendación:** migrar el almacenamiento a hashes específicos para contraseñas, como Argon2id, scrypt o bcrypt, con parámetros actuales y comparación mediante la función de verificación de esa biblioteca. Diseñar una transición para cuentas existentes y evitar registrar contraseñas en logs.

### 5. TLS de base de datos sin validación de certificado

**Impacto:** posible interceptación o alteración del tráfico entre aplicación y una base de datos remota.

**Recomendación:** mantener TLS con verificación del certificado del servidor y configurar la CA confiable que corresponda al proveedor de base de datos. Confirmar la opción efectiva en cada entorno.

### 6. Transporte HTTP sin TLS visible en el listener

**Impacto:** exposición de credenciales y secretos transmitidos si el tráfico HTTP es accesible desde redes no confiables.

**Recomendación:** asegurar HTTPS desde el exterior. Puede terminarse TLS en un ingress o reverse proxy correctamente configurado, siempre que la aplicación no quede expuesta por una ruta alternativa en texto claro y que el tramo interno esté protegido según el modelo de red.

## Prioridad de remediación sugerida

1. Impedir que el registro público asigne roles privilegiados.
2. Sustituir `x-cod-user` como autenticación por una identidad verificada y una sesión o token firmado.
3. Evitar que un cliente pueda autoasignarse peso que genera puntos; verificar mediciones de origen confiable y acordar límites.
4. Migrar las contraseñas almacenadas en texto plano a hashes seguros.
5. Habilitar verificación de certificado TLS para conexiones de base de datos remotas.
6. Confirmar y exigir HTTPS en todos los puntos de entrada externos.

## Consideraciones

- Los hallazgos 5 y 6 dependen de la configuración real del despliegue; se señalan porque el código permite esas condiciones, pero no se verificó si existe un certificado confiable, proxy TLS u otra mitigación en producción.
- Este informe es una revisión estática, no una certificación de ausencia de vulnerabilidades.
- No se modificó código como parte de la revisión ni se ejecutaron comandos de Git.