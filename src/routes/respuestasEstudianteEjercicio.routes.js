const express = require('express');
const router = express.Router();
const controller = require('../controllers/respuestasEstudianteEjercicio.controller');

// Responde a: POST http://localhost:4000/respuestasEstudianteEjercicio
router.post('/', controller.crearRespuestaEjercicio);

// Responde a: GET http://localhost:4000/respuestasEstudianteEjercicio/resultado/:token
router.get('/resultado/:token', controller.obtenerResultadoJudge0);

// Ruta de verificación de completitud (antes de /:id para evitar conflictos)
router.get('/verificar-completado', controller.verificarEjercicioCompletado);

// CRUD
router.get('/', controller.obtenerRespuestasEjercicio);
router.get('/:id', controller.obtenerRespuestaEjercicioPorId);

module.exports = router;