# EduPath-Backend

## Cambios recientes

- `respuestas_estudiante_ejercicio.respuesta` ahora es JSONB para permitir respuestas dinámicas (texto, objetos, arreglos y metadatos de archivos).
- El endpoint `POST /respuestasEstudianteEjercicio` acepta `respuesta` como `string | object | array`. Si llega string, se almacena como `{ "texto": "..." }`.
- El resolver de UML acepta `diagram` en `req.body.diagram` o en `req.body.respuesta.diagram`.
- Nuevo endpoint `POST /ejercicios/:ejercicioId/enviar`: guarda intento y evalúa; si es correcto, crea `evaluacion` con `estado: "Aprobado"`.

### Migración de base de datos (PostgreSQL)

Si ya tienes datos en la tabla `respuestas_estudiante_ejercicio`, aplica esta migración para convertir `respuesta` (TEXT) a `JSONB` de forma segura:

```sql
-- 1) Agregar columna temporal JSONB
ALTER TABLE respuestas_estudiante_ejercicio ADD COLUMN respuesta_tmp JSONB;

-- 2) Migrar valores existentes
UPDATE respuestas_estudiante_ejercicio
SET respuesta_tmp = CASE
	WHEN respuesta IS NULL THEN 'null'::jsonb
	WHEN LENGTH(TRIM(respuesta)) > 0 AND LEFT(TRIM(respuesta), 1) IN ('{','[') THEN respuesta::jsonb
	ELSE jsonb_build_object('texto', respuesta)
END;

-- 3) Reemplazar columna
ALTER TABLE respuestas_estudiante_ejercicio DROP COLUMN respuesta;
ALTER TABLE respuestas_estudiante_ejercicio RENAME COLUMN respuesta_tmp TO respuesta;
```

## Endpoints relevantes

- Enviar y evaluar en un solo paso:
	- `POST /ejercicios/:ejercicioId/enviar`
	- Body:
		```json
		{
			"estudiante_id": 123,
			"respuesta": { "texto": "hola" }
			// UML: { "diagram": { "cells": [...] } }
			// Preguntas: { "respuestas": { "p1": "A", "p2": true } }
		}
		```
	- Respuesta 200:
		```json
		{
			"intentoId": 1,
			"ejercicioId": "10",
			"esCorrecta": true,
			"puntosObtenidos": 10,
			"detalle": { "errors": [], "warnings": [] },
			"retroalimentacion": "¡Respuesta correcta! Bien hecho."
		}
		```
	- Se registra en `evaluacion` con `estado: "Aprobado"` si es correcta, o `"Reprobado"` si es incorrecta.

- Guardar intento sin evaluar (opcional):
	- `POST /respuestasEstudianteEjercicio`
	- Body: `{ estudiante_id, ejercicio_id, respuesta, estado? }`
		- Regla: solo se permite un envío por `estudiante_id + ejercicio_id`. Si ya existe, devuelve `409` con `intentoId`.

- Evaluaciones
	- Auto-creación: `POST /ejercicios/:id/enviar` crea `evaluacion` con `estado: "Aprobado"` si la respuesta es correcta.
	- En respuestas incorrectas, se crea/actualiza `evaluacion` con `estado: "Reprobado"` y `calificacion: 0`. No se permiten nuevos envíos.
	- Listado: `GET /evaluaciones`
	- Detalle: `GET /evaluaciones/:id`
	- Filtro: `GET /evaluaciones/by?estudiante_id=123&ejercicio_id=10` (cualquiera de los 3 parámetros)
	- Reglas de unicidad en BD:
		- `ux_eval_estudiante_ejercicio (estudiante_id, ejercicio_id)`
		- `ux_eval_estudiante_miniproyecto (estudiante_id, miniproyecto_id)`

### Índice de unicidad en respuestas

Si existía el índice único `ux_estudiante_ejercicio` en `respuestas_estudiante_ejercicio`, eliminarlo para permitir reintentos:

La tabla `respuestas_estudiante_ejercicio` define `ux_estudiante_ejercicio (estudiante_id, ejercicio_id)` para permitir solo un registro por estudiante+ejercicio.