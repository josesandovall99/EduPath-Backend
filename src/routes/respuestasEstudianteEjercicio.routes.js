const express = require('express');
const router = express.Router();
const controller = require('../controllers/respuestasEstudianteEjercicio.controller');

// --- Rutas de Integración con Judge0 ---

// Crear respuesta (envía a Judge0 y guarda en DB)
router.post('/', controller.crearRespuestaEjercicio);

// Consultar el resultado de ejecución mediante el Token de Judge0
router.get('/resultado/:token', controller.obtenerResultadoJudge0);

// --- Rutas CRUD Estándar ---

// Obtener todas las respuestas
router.get('/', controller.obtenerRespuestasEjercicio);

// Obtener una respuesta específica por su ID de base de datos
router.get('/:id', controller.obtenerRespuestaEjercicioPorId);

// Actualizar una respuesta
router.put('/:id', controller.actualizarRespuestaEjercicio);

// Eliminar una respuesta
router.delete('/:id', controller.eliminarRespuestaEjercicio);

module.exports = router;