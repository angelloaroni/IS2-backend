# Release 2: base común de Fase 0

**Estado: base técnica implementada y acuerdos comunes aprobados por el usuario.**
Está preparada para la revisión cruzada A/B exigida por el PDF; no se certifica que
esas personas ya la hayan revisado. Ver [validacion.md](validacion.md).

## Fuentes y alcance

- Fuente principal: `Guia_backend_Release_2.pdf`, páginas 2, 7, 8 y 9 para Fase 0.
  Páginas 3–6 y fases 1–3 describen funcionalidades posteriores; no se implementan.
- Contexto funcional: hoja `Backlog` del Excel adjunto `Hoja de cálculo sin título.xlsx`.
  Las asignaciones nominales de `Tareas` no delimitan el trabajo.
- Base R1: `5f7d12ca0b020edfd49ba3bf90b9345dd4ea7488`, rama local de origen `work`;
  coincide con la referencia del PDF. R1 se asume implementado y se conserva.
- Única rama: `Sprint2/Modificaciones-Angello`, confirmada por el usuario como base.
  No se crearon otras ramas ni se hicieron merges o rebases. El usuario autorizó
  posteriormente crear el commit y publicar esta rama en GitHub.
- Las respuestas del usuario completan las propuestas del PDF; se registran en
  [decisiones.md](decisiones.md), sin ampliar la implementación a fases posteriores.

Solo se añaden documentación, contratos de prueba, fixtures y dobles. No se añaden
endpoints, listeners, dependencias, tablas o modelos ni se conectan dobles a producción.

## Entregables

| Entregable | Ubicación | Propósito |
| --- | --- | --- |
| Datos, consultas, esquema propuesto y plan de migración | [datos.md](datos.md) | Contratos A → B y política temporal/datos |
| API, permisos, eventos y ejemplos | [contratos.md](contratos.md) | Compatibilidad R1 y base de implementación R2 |
| Acuerdos autorizados | [decisiones.md](decisiones.md) | Evidencia de decisiones del usuario y elecciones delegadas |
| Trabajo independiente | [paralelo.md](paralelo.md) | Propiedad y cómo empezar sin código del otro |
| Firmas, fixtures, dobles y verificador compartido | `src/stubs/release2/` | Escenarios ejecutables y sustitución por proveedor real |
| Pruebas y evidencias | `test/release2-base.test.js`, [validacion.md](validacion.md) | Validación técnica y límites |

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

El verificador se podrá ejecutar con el proveedor real y los mismos datos en una
BD de prueba aislada. No confundir el doble con una consulta real, ni los fixtures
de recuperación con una cola que ya recupera eventos. R2 real se implementa en las
fases siguientes. El proyecto es JavaScript ESM y no define comando de compilación.
