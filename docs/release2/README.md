# Release 2: base común y backend B

**Estado: base de Fase 0 y paquetes B1–B6 implementados.** La revisión cruzada A/B
y la aplicación de la migración en una base PostgreSQL de desarrollo siguen
pendientes. Ver [validacion.md](validacion.md).

## Fuentes y alcance

- Fuente principal: `Guia_backend_Release_2.pdf`, páginas 5–11 para los paquetes B1–B6,
  contratos, integración y aceptación.
- Contexto funcional: hoja `Backlog` del Excel adjunto `Hoja de cálculo sin título.xlsx`.
  Las asignaciones nominales de `Tareas` no delimitan el trabajo.
- Base R1: `5f7d12ca0b020edfd49ba3bf90b9345dd4ea7488`, rama local de origen `work`;
  coincide con la referencia del PDF. R1 se asume implementado y se conserva.
- Única rama: `Sprint2/Modificaciones-Angello`, confirmada por el usuario como base.
  No se crearon otras ramas ni se hicieron merges o rebases. El usuario autorizó
  posteriormente crear el commit y publicar esta rama en GitHub.
- Las respuestas del usuario completan las propuestas del PDF; se registran en
  [decisiones.md](decisiones.md).

La implementación B sigue las capas existentes de rutas, controladores, servicios,
repositorios y modelos. No se conectan dobles a producción ni se añaden dependencias.

## Entregables

| Entregable | Ubicación | Propósito |
| --- | --- | --- |
| Datos, consultas, esquema propuesto y plan de migración | [datos.md](datos.md) | Contratos A → B y política temporal/datos |
| API, permisos, eventos y ejemplos | [contratos.md](contratos.md) | Compatibilidad R1 y base de implementación R2 |
| Acuerdos autorizados | [decisiones.md](decisiones.md) | Evidencia de decisiones del usuario y elecciones delegadas |
| Trabajo independiente | [paralelo.md](paralelo.md) | Propiedad y cómo empezar sin código del otro |
| Firmas, fixtures, dobles y verificador compartido | `src/stubs/release2/` | Escenarios ejecutables y sustitución por proveedor real |
| Pruebas y evidencias | `test/release2-base.test.js`, [validacion.md](validacion.md) | Validación técnica y límites |
| Endpoints y reglas B1–B6 | `src/routes/`, `src/controllers/`, `src/services/`, `src/repositories/`, `src/models/` | Usuarios, perfil, canjes, ranking, notificaciones y logros |
| Persistencia B | `database/migrations/20261105_add_ranking_notifications_and_event_outbox.sql` | Configuración, exclusiones, deduplicación, outbox y estado top 10 |

## Contexto de historias de usuario

| Dominio | HU | Contexto conservado |
| --- | --- | --- |
| Datos/ubicación | HU16, HU17, HU18, HU5 | Materiales, participación, impacto y consulta de tachos |
| Identidad | HU25 | Código actual y formatos MQTT; sin nuevo mecanismo físico |
| Cuenta | HU10, HU4 | Admin edita nombre/estado; perfil solo nombre |
| Recompensas | HU11, HU12, HU14, HU15, HU19, HU22 | Canje, ranking calculado, reconocimiento, bandeja y logros |
| R1 | HU1, HU2, HU3, HU7, HU8, HU9, HU13, HU20, HU21, HU24 | Reutilizar lo existente sin rehacer HU ni hardware |

HU6 y HU26 aportan contexto de consumo/entrada; HU23 no añade apertura física al
backend. El usuario delegó resolver HU12: criterios/períodos y exclusiones sin
posiciones manuales ni borrado de actividad. La ubicación de recompensa de HU11
no introduce campos en esta base.

## Ejecutar la validación

Desde la raíz:

```sh
node --test test/release2-base.test.js
npm test
node --input-type=module -e "import {crearDobleBaseRelease2} from './src/stubs/release2/estadisticas.doble.js'; import {verificarContratoEstadisticas} from './src/stubs/release2/verificar-estadisticas.js'; await verificarContratoEstadisticas(crearDobleBaseRelease2()); console.log('Contrato A/B correcto');"
```

El contrato de ranking configurado es `{ desde, hasta, excluidos }`; el criterio
permanece fijo en puntos ganados según los acuerdos. La migración debe aplicarse
antes de iniciar la versión nueva del backend. El proyecto es JavaScript ESM y no
define comando de compilación.
