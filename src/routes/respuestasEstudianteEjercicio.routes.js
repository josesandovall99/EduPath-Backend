const express = require('express');
const router = express.Router();
const controller = require('../controllers/respuestasEstudianteEjercicio.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');

// Crear respuesta de estudiante a ejercicio
router.post('/', autenticacionUsuario, controller.crearRespuestaEjercicio);

// Verificar completitud (antes de /:id para evitar conflictos)
router.get('/verificar-completado', autenticacionUsuario, controller.verificarEjercicioCompletado);

// CRUD básico
router.get('/', autenticacionUsuario, controller.obtenerRespuestasEjercicio);
router.get('/:id', autenticacionUsuario, controller.obtenerRespuestaEjercicioPorId);

module.exports = router;