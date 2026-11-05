# Acuerdos aprobados de Fase 0

Este registro incorpora las respuestas explícitas del usuario y su aprobación de
la propuesta complementaria. Los acuerdos definen R2; no autorizan implementar
fases posteriores ni alterar las funcionalidades de R1 en esta base.

| ID | Acuerdo aprobado | Consecuencia para los contratos |
| --- | --- | --- |
| D01 | Ganado separado del saldo canjeable | Ranking y logros por acumulación usan ganado; canjear reduce saldo, no ganado |
| D02 | Mes calendario America/Lima, filtros `[desde,hasta)` | Límites opcionales `YYYY-MM-DD`; fecha inicial incluida y final excluida; sin límites: histórico |
| D03 | Ranking de cuentas tipo usuario activas | Orden ganado DESC, id_user ASC; mes sin actividad: ganador null; elegibilidad y posiciones pertenecen a B |
| D04 | Participación según cuentas activas al consultar | Numerador: usuarios activos distintos con actividad en período; denominador: todos los usuarios activos, incluso sin actividad; excluir admins/inactivos de ambos; porcentaje, null si denominador cero |
| D05 | Elección de impacto delegada | Se eligen kg por material, actividades y períodos; equivalencias CO2/agua/árboles se difieren hasta contar con fuente, unidad y versión aprobadas |
| D06 | Campos editables | Perfil solo nombre; admin nombre/estado; excluir código, rol, saldo, contraseña y cambio de correo del PATCH genérico |
| D07 | Bandeja API y entrega recuperable | Persistir eventos pendientes con el efecto productor; entrega y efecto idempotentes por consumidor con reintentos; no añadir canal externo |
| D08 | Mantener codUser | Sin nuevo mapeo QR/RFID; identidad de usuario separada de autenticación del dispositivo en broker |
| D09 | Configuración solo admin, ranking visible para usuarios registrados | GET/PUT config solo admin; ranking y ganador mensual con JWT y cuenta activa; conservar bloqueo de cuentas inactivas de R1 |
| D10 | Tarifa histórica siempre 10 puntos/kg | Relleno futuro con esa regla confirmada para los tres materiales admitidos; conservar DATE antiguos como días de Lima sin inventar horas; datos nuevos conservan además instante UTC |
| D11 | Cuenta inexistente | AppError 404, mensaje `Esta cuenta no existe`, envoltura de error R1 |
| D12 | Una única rama | Sprint2/Modificaciones-Angello es la base de integración; sin rama adicional |
| D13 | Resolución de HU12 delegada | Gestión por criterios/períodos y exclusión de participantes; reiniciar eligiendo otro período, sin borrar actividad; posiciones calculadas, sin edición manual |

## Avisos aprobados

- Registro de cuenta: para administradores.
- Entrada al top 10: para el usuario que ingresa, una vez por transición y período.
- Reciclaje, logro/medalla y canje: para el usuario del efecto confirmado.
- Premio nuevo y novedades: para usuarios activos.
- El futuro evento de canje incorpora `idCanje = id_usuario_premio`.
- Referencia estable por evento y estado de entrega independiente por consumidor.

Para HU12 se conserva un ranking reproducible: posición por puntaje y desempate,
no un número arbitrario. Excluir del ranking no bloquea la cuenta ni borra su
historial. Se aplicará la misma configuración al top, posición propia y ganador.
Su persistencia y endpoints pertenecen a fases posteriores.

## Límites y revisión

La aprobación complementaria cerró denominador, inactivos, límites temporales,
política DATE, destinatarios/transiciones y referencia de canje. No quedan preguntas
al usuario sobre esos acuerdos. No se aplican migraciones, motores ni listeners R2
en esta fase. Los tipos SQL, índices y almacenamiento concreto se diseñan en A6,
sin cambiar estas interfaces ni decidirlos unilateralmente fuera del alcance aprobado.

Los detalles internos de cada módulo y de endpoints posteriores que no fija el
PDF no se convierten en decisiones técnicas implícitas de esta base. Antes de
implementarlos, sus responsables deben respetar la restricción del usuario sobre
nuevas decisiones. La ubicación de recompensa de HU11 no añade campos a esta fase.

El PDF pide revisión cruzada de ambos desarrolladores. Los archivos están
preparados para esa revisión; no se certifica que A/B la hayan realizado. La base
técnica y sus pruebas no sustituyen esa aceptación humana.
