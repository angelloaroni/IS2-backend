Instrucciones mínimas de uso del repositorio

- Instalar dependencias:

```bash
npm install
```

- Formatear el código con Prettier:

```bash
npm run format
```

Nota: este `README` solo contiene instrucciones de formato. Para más detalles, consulta los archivos de configuración (`.prettierrc`, `.eslintrc.json`).

## Reciclaje

### Métricas del usuario

`GET /api/usuarios/me/metricas` requiere autenticación de usuario y calcula los totales exclusivamente para el usuario autenticado. La respuesta incluye `totalResiduos`, `pesoTotalKg`, `porTipo`, `porPeriodo` (agrupado por mes) y `porTipoYPeriodo`.

### Recepción de datos del tacho

`POST /api/tachos/recepcion` se autentica por separado del usuario mediante el header `x-tacho-api-key`, configurado en `TACHO_API_KEY`. El servidor obtiene la fecha y los puntos; el tacho no debe enviarlos.

El cuerpo JSON acordado es:

```json
{
  "idEvento": "identificador-unico-generado-por-el-tacho",
  "codUser": "00001001",
  "idTacho": 1,
  "tipo": "plastico",
  "peso": 0.25
}
```

Los tipos aceptados son `plastico`, `papel/carton` y `organicos`. `idEvento` se usa como clave de idempotencia; reutilizarla no vuelve a registrar el residuo ni sumar puntos.
