const express = require('express');
const router = express.Router();
const ejercicioController = require('../controllers/ejercicio.controller');

router.post('/', ejercicioController.createEjercicio);
router.get('/', ejercicioController.getEjercicios);
router.post('/:ejercicioId/resolver', ejercicioController.resolverEjercicio);
router.get('/:ejercicioId/retroalimentacion', ejercicioController.getRetroalimentacionEjercicio);



module.exports = router;
