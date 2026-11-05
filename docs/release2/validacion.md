# Evidencias y límites de Release 2

## Implementación de la parte B

Fecha: 5 de noviembre de 2026 (`America/Lima`).

| Verificación | Resultado | Alcance |
| --- | --- | --- |
| `node --test test/release2-b.test.js test/release2-base.test.js` | 25 aprobadas | Usuarios, perfil, canje, ranking, filtros, logros, outbox y top 10 con dobles |
| `node --test` | 43 aprobadas | Suite completa del backend |
| Migración R2 | Creada, no aplicada | Debe ejecutarse en una base PostgreSQL antes de desplegar |
| PostgreSQL concurrente / reinicio del proceso | Pendiente | Las pruebas unitarias no sustituyen integración real |

La implementación B cubre B1–B6. El contrato de ranking usa `{ desde, hasta,
excluidos }`; el criterio queda fijo en puntos ganados según D03/D13. El canje
confirma canje, saldo, stock y evento pendiente en una transacción. Logros y
notificaciones procesan el outbox de manera idempotente y registran errores con
reintentos. El top 10 mantiene el estado por mes Lima para detectar transiciones.

La consulta compartida de actividad conserva los campos del contrato A → B,
deduplica residuos al agrupar por id y devuelve error explícito ante historial con
fechas o usuarios ambiguos. La fecha DATE nueva se persiste como día Lima; el
payload público del evento conserva su `Date`.

La suite verifica contratos y reglas con dobles. No se conectó a PostgreSQL ni se
aplicó la migración en este trabajo; el arranque nuevo requiere la migración
`20261105_add_ranking_notifications_and_event_outbox.sql`.

## Evidencias históricas de Fase 0

Fecha local: 4 de noviembre de 2026 (`America/Lima`).
Rama: `Sprint2/Modificaciones-Angello`, creada desde `work` en
`5f7d12ca0b020edfd49ba3bf90b9345dd4ea7488`.

## Verificaciones ejecutadas

| Verificación | Resultado | Qué demuestra |
| --- | --- | --- |
| `node --test test/release2-base.test.js` | 14 aprobadas, 0 fallidas/omitidas | Firmas con dobles, vacíos explícitos, propagación de filtros, errores programados, aislamiento, fixtures y eventos |
| `npm test` | 32 aprobadas, 0 fallidas/omitidas | 18 pruebas existentes más las 14 nuevas; sin regresiones detectadas por esta suite |
| `node --check` sobre los cuatro módulos nuevos | Aprobado | Sintaxis ESM de contratos, fixtures, doble y verificador |
| API local `GET /` | 200, `API Tachin Verde` | El proceso existente sigue respondiendo |
| Prueba funcional con PostgreSQL/SMTP/MQTT de desarrollo | Aprobada | Captura de correo, verificación, registro, login, métricas con JWT y actualización de tacho en BD por MQTT |
| `git diff --exit-code` contra HEAD | Sin diferencias en archivos existentes | Código, modelos, SQL, routers, dependencias y lockfile de R1 intactos |

Se ejecutaron los runners de Node fuera de la restricción del ejecutor que solo
informaba archivos de prueba en lugar de casos individuales; los conteos de arriba
corresponden a casos efectivamente ejecutados. No se usa ese conteo inicial como
evidencia de cobertura.

La prueba funcional reutilizó servicios locales del entorno ya preparado, no un
broker privado ni correo externo. El auxiliar de onboarding existente tuvo un primer
fallo de lectura: seleccionó ocho dígitos de la cabecera MIME en vez del código del
cuerpo. Se comprobó esa diferencia y se repitió con una copia temporal
`/tmp/release2-smoke.mjs` que busca el código en el texto del mensaje. Pasaron ambas
comprobaciones funcionales. No se cambió el auxiliar original ni el backend.
Los registros temporales de usuario/verificación/tacho se eliminaron al finalizar.

La última validación funcional se repitió tras incorporar las aprobaciones;
pasaron nuevamente ambos checks. El mismo conjunto de escenarios de estadísticas
se puede ejecutar con el doble o con el proveedor real cargado con fixtures en una
BD de prueba aislada. El verificador no impone orden a las filas: A entrega datos
y B ordena ranking. La prueba también comprueba que una respuesta incompleta falle.

La prueba de contrato de R1 intercepta únicamente sus dependencias en el proceso
de prueba y las restaura. Verifica el servicio real `registrarResiduo`: historial y
saldo preceden al commit; el evento conserva los siete campos publicados; un
duplicado provoca rollback y no emite otro evento. No sustituye una prueba de
concurrencia real ni implementa A6.

## Lo que no se afirma

- No existe comando de compilación configurado. Se comprobó sintaxis y ejecución;
  no se inventó un build ni se incorporaron herramientas.
- No se afirma cobertura exhaustiva de cada HU de R1; se conserva su implementación,
  pasa la suite disponible y se verifica el flujo funcional descrito.
- La migración R2 de B se creó, pero no se ejecutó ni se probó contra PostgreSQL.
- Los dobles validan contratos, no sustituyen pruebas PostgreSQL de consultas,
  concurrencia de canjes, recuperación tras reinicio ni locking del top 10.
- Los acuerdos comunes de [decisiones.md](decisiones.md) y la rama como base de
  integración ya fueron aprobados por el usuario. Falta la revisión cruzada A/B
  exigida por el PDF: la base técnica está implementada, pero no se declara el
  cierre formal completo de Fase 0 sin esa revisión humana.
- No se crearon ramas adicionales ni se hicieron merges o rebases. Tras validar
  la base, el usuario autorizó crear el commit y publicar la rama en GitHub.

## Archivos añadidos

| Archivo | Propósito |
| --- | --- |
| `docs/release2/README.md` | Fuentes, alcance, contexto HU y estado de Fase 0 |
| `docs/release2/datos.md` | Base R1, consultas compartidas, política temporal y plan de migración A6 |
| `docs/release2/contratos.md` | API, permisos, firmas, eventos y compatibilidad |
| `docs/release2/decisiones.md` | Registro de decisiones aprobadas y elecciones delegadas |
| `docs/release2/paralelo.md` | Propiedad de archivos, uso independiente de dobles e integración posterior |
| `docs/release2/validacion.md` | Estas evidencias y limitaciones |
| `src/stubs/release2/contratos.js` | Tipos JSDoc de las firmas de página 8 y acuerdos aprobados |
| `src/stubs/release2/fixtures.js` | Cuentas, datos, resultados y eventos sintéticos compartidos |
| `src/stubs/release2/estadisticas.doble.js` | Proveedor programable aislado para pruebas de ambos módulos |
| `src/stubs/release2/verificar-estadisticas.js` | Escenario reutilizable para contrastar doble y futuro proveedor real |
| `test/release2-base.test.js` | Catorce pruebas de la base y conservación del contrato de reciclaje R1 |
