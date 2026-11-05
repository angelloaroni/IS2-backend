# Trabajo independiente e integración posterior

## Propiedad definida: un editor por archivo compartido

Los límites A/B del PDF son límites de módulos, no asignaciones nominales del Excel.

| Área | Editor del PDF | Regla |
| --- | --- | --- |
| Datos, dashboard, métricas, residuos, MQTT y tachos | A | Capas de páginas 3–4; proveedor de datos sin ranking ni premios |
| Usuarios, perfil, canjes, ranking, logros y notificaciones | B | Capas de páginas 5–6; usa proveedor A sin duplicar joins |
| `database/schema.sql` y migraciones | A | B entrega requisitos; una secuencia SQL, no migraciones paralelas de campos iguales |
| `src/routes/index.routes.js`, `usuario.routes.js` | B | A entrega router/controlador y pruebas aisladas; B registra rutas acordadas |
| `src/utils/eventos.js`, `listeners.js` | B | A conserva payloads; no duplicar consumidores con el mismo efecto |
| `src/app.js`, `index.js`, `.env.example`, `package*.json` | Editor nombrado antes del cambio | Cambio separado, revisión de ambos; Fase 0 no los modifica |
| `docs/release2/datos.md` | A, revisión B | Contrato/fixture antes de cambiar dato compartido |
| `docs/release2/contratos.md` | B, revisión A | No modificar firmas, permiso o payload unilateralmente |

Para esta entrega individual se implementaron los paquetes B1–B6 y las piezas
compartidas indispensables para conectarlos: consulta de actividad de solo lectura,
escritura del outbox desde los productores existentes y esquema/migración. La
propiedad A/B de la tabla describe el reparto de equipo del PDF; la migración aún
requiere aplicación y revisión cruzada.

`index.routes.js` importa `usuario.routes.js` y `premios.routes.js`. No usar los
archivos antiguos de nombre similar ni la fachada obtenerInfo por suposición; no
eliminar globalmente `src/stubs/`. Cada módulo preserva las capas ESM existentes.

## Inicio de A sin esperar a B

A dispone de fixtures de cuenta, residuo, historial, tacho y resultados para
preparar A6/consultas sobre una BD de prueba. El conjunto contiene actividad de
admins e inactivos: el proveedor devuelve datos y B aplica elegibilidad. A compara
con el verificador común sin necesitar ranking, canje, logros o notificaciones.
Puede probar sus servicios/controladores antes del montaje HTTP por B.

La recuperación exigida tiene contrato compartido y escenarios por consumidor;
A prepara persistencia de pendiente atómica con su efecto sin esperar un consumidor
funcionando. La implementación SQL se revisa en A6, sin delegar su diseño a una
entrega tardía de B ni introducir la cola en esta fase.

## Implementación de B

B1/B2 ofrecen administración paginada y perfil restringido. B3 bloquea saldo y
stock, confirma canje y outbox en una transacción. B4 usa el proveedor de actividad
sin repetir joins en ranking/logros, con período, exclusiones y desempate estable.
B5 consume eventos pendientes con deduplicación y reintentos; B6 evalúa ganado y
otorga una sola vez. Las pruebas siguen usando los dobles para aislar los contratos.

Ejemplo ejecutable desde la raíz con `node --input-type=module`:

```js
import { crearDobleBaseRelease2 } from './src/stubs/release2/estadisticas.doble.js';
import { verificarContratoEstadisticas } from './src/stubs/release2/verificar-estadisticas.js';

const proveedor = crearDobleBaseRelease2();
await verificarContratoEstadisticas(proveedor);
const datos = await proveedor.listarActividadPorUsuario({
    desde: '2026-01-01', hasta: '2026-02-01',
});
// Usar el doble solo en pruebas; producción usa el repositorio de métricas.
```

Para un escenario propio, `crearDobleEstadisticas(escenarios)` admite respuestas o
fallos explícitos. No suma ni filtra: una llamada no programada falla, no responde
ceros ocultando que falta un caso. Devuelve copias para que pruebas de A/B no
compartan mutaciones. Sus imports no cargan modelos, servicios ni BD.

## Integración sin cambios estructurales nuevos

Las dos funciones del proveedor y sus resultados son los de página 8. El proveedor
real se sustituye en la prueba y se ejecuta el **mismo verificador**, usando una BD
**aislada** con los datos de fixture; no ejecutarlo contra cuentas reales con IDs
coincidentes. B no necesita reconstruir joins ni A decidir posiciones.

El ranking y los logros consumen el mismo contrato que valida el verificador.
La implementación real agrega la lectura de actividad en `metrica.repository.js`;
los residuos y sus eventos pendientes se confirman juntos en `residuo.service.js`.

Las reglas de fechas, ganado, permisos y configuración del ranking están aprobadas.
El JSON de configuración implementado es `{ desde, hasta, excluidos }`, con criterio
fijo por puntos ganados y períodos `[desde,hasta)`.

## Límites y aceptación

- El bus EventEmitter se conserva para compatibilidad; los consumidores B procesan
  el outbox persistente para que una caída no pierda notificaciones ni logros.
- La migración SQL está añadida, pero no se ejecutó en una base PostgreSQL durante
  esta sesión. El backend nuevo requiere aplicarla antes de iniciar.
- La única rama autorizada es Sprint2/Modificaciones-Angello. Las ramas feature del
  PDF no se crean aquí; no hay merges/rebases autorizados. El usuario autorizó
  posteriormente publicar esta rama en GitHub.
- La revisión cruzada A/B requerida por el PDF sigue siendo aceptación humana
  pendiente. No se presenta como realizada por este trabajo.
