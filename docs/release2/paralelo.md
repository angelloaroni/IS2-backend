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

## Inicio de B sin esperar a A

B usa `crearDobleBaseRelease2()` para histórico, meses, cuenta sin actividad y
cuenta inexistente. Puede desarrollar pruebas de ranking/logros con ganado distinto
de saldo, sin migraciones ni consultas reales de A. Fixtures de avisos, canje R2 y
entrega parcial permiten preparar pruebas de consumidores sin el productor real.

Ejemplo ejecutable desde la raíz con `node --input-type=module`:

```js
import { crearDobleBaseRelease2 } from './src/stubs/release2/estadisticas.doble.js';
import { verificarContratoEstadisticas } from './src/stubs/release2/verificar-estadisticas.js';

const proveedor = crearDobleBaseRelease2();
await verificarContratoEstadisticas(proveedor);
const datos = await proveedor.listarActividadPorUsuario({
    desde: '2026-01-01', hasta: '2026-02-01',
});
// Usar proveedor como dependencia simulada del futuro consumidor de B.
// No montar el doble en Express ni reemplazar globalmente servicios R1.
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

Conectar esta dependencia a servicios de producción corresponde a fases 1–2; no
se refactorizan servicios R1 para inyectar un doble en Fase 0. Cambios compartidos
empiezan por contrato y fixture, no por una nueva interfaz incompatible.

Las reglas de fechas, ganado, participación y permisos ya están aprobadas. No hay
un entregable funcional del otro desarrollador que impida comenzar pruebas aisladas.
El proveedor real, SQL, trabajadores y montaje de rutas son hitos posteriores;
los detalles locales que aún requieran decisión del usuario se formalizan antes
de implementarlos, sin cambiar por suposición la base común.

## Límites y aceptación

- R1 sigue con bus en memoria; todavía no recupera eventos tras caída. Esa garantía
  R2 debe implementarse y probarse en fases posteriores, no se presume validada.
- A centraliza SQL y B routers/eventos: sigue habiendo coordinación de integración,
  aunque pueden trabajar con módulos y dobles sin esperar código del otro.
- Los tipos SQL y contratos locales de nuevos endpoints no fijados por el PDF no
  se deciden unilateralmente durante esta fase.
- La única rama autorizada es Sprint2/Modificaciones-Angello. Las ramas feature del
  PDF no se crean aquí; no hay merges/rebases autorizados. El usuario autorizó
  posteriormente publicar esta rama en GitHub.
- La revisión cruzada A/B requerida por el PDF sigue siendo aceptación humana
  pendiente. No se presenta como realizada por este trabajo.
