# Contratos - Sección 6 (Borrador)

Este documento contiene los contratos (endpoints, request/response, códigos) relacionados con la Sección 6. Es un borrador; revísalo y dime si quieres formato OpenAPI (YAML/JSON) o integración con tests.

## Resumen de recursos (ejemplos relevantes)
- Usuario: obtener por id, sumar/restar puntos

---

## 1) Obtener usuario por id

- Método: GET
- Ruta: /api/usuarios/{id}
- Descripción: Devuelve los datos del usuario identificado por `id`.

Request
- Parámetros de ruta: `id` (integer)

Responses
- 200 OK
  - Content-Type: application/json
  - Body ejemplo:

```json
{
  "id_user": 123,
  "cod_user": 1,
  "nombre": "Juan Perez",
  "puntos": 42.5,
  "tipo": "ciudadano",
  "estado": true
}
```

- 404 Not Found
  - Body:

```json
{ "message": "Usuario no encontrado" }
```

---

## 2) Sumar puntos a usuario

- Método: POST
- Ruta: /api/usuarios/{id}/puntos/sumar
- Descripción: Aumenta el saldo de puntos del usuario.

Request
- Parámetros de ruta: `id` (integer)
- Body (application/json):

```json
{
  "puntos": 10.5
}
```

Responses
- 200 OK
  - Body ejemplo (usuario actualizado):

```json
{
  "id_user": 123,
  "puntos": 53.0
}
```

- 400 Bad Request
  - Si `puntos` no es numérico o falta.

- 404 Not Found
  - Si no existe el usuario.

Notas de implementación
- Usar operación atómica (transacción) si se suma puntos junto con otras modificaciones.
- Validar que `puntos` > 0.

---

## 3) Restar puntos a usuario

- Método: POST
- Ruta: /api/usuarios/{id}/puntos/restar
- Descripción: Resta puntos del usuario (puede permitir saldo negativo o validar mínimo).

Request
- Body (application/json):

```json
{
  "puntos": 5
}
```

Responses
- 200 OK
  - Body ejemplo:

```json
{
  "id_user": 123,
  "puntos": 48.0
}
```

- 400 Bad Request
  - Si `puntos` inválido o si la política impide saldo negativo.

- 404 Not Found
  - Si no existe el usuario.

Notas de implementación
- Validar políticas de negocio (saldo mínimo). Usar transacciones si necesario.

---

## Plantilla de contrato (por endpoint)

- Método: 
- Ruta:
- Descripción:
- Request params/headers/body:
- Responses (200,4xx,5xx) con ejemplos:
- Notas/validaciones/consistencia con DB:

---

## Siguientes pasos sugeridos
- Convertir estos contratos a formato OpenAPI (YAML) y añadir al repo como `src/stubs/openapi/section6.yaml`.
- Crear tests de integración que verifiquen los contratos (pact, supertest, etc.).
