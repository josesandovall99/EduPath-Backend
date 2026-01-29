const express = require('express');
const router = express.Router();
const controller = require('../controllers/respuestasEstudianteEjercicio.controller');

// Crear respuesta de estudiante a ejercicio
router.post('/', controller.crearRespuestaEjercicio);

// Verificar completitud (antes de /:id para evitar conflictos)
router.get('/verificar-completado', controller.verificarEjercicioCompletado);

// CRUD básico
router.get('/', controller.obtenerRespuestasEjercicio);
router.get('/:id', controller.obtenerRespuestaEjercicioPorId);

module.exports = router;