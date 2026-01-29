const express = require('express');
const router = express.Router();
const ejercicioController = require('../controllers/ejercicio.controller');

// CRUD básico
router.post('/', ejercicioController.createEjercicio);
router.get('/', ejercicioController.getEjercicios);
router.get('/:id', ejercicioController.getEjercicioById);
router.put('/:id', ejercicioController.updateEjercicio);
router.delete('/:id', ejercicioController.deleteEjercicio);

// Funcionalidades específicas de ejercicios
router.post('/:ejercicioId/resolver', ejercicioController.resolverEjercicio);
router.post('/:ejercicioId/enviar', ejercicioController.enviarRespuestaEjercicio);
router.get('/:ejercicioId/retroalimentacion', ejercicioController.getRetroalimentacionEjercicio);

module.exports = router;
