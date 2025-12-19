const express = require('express');
const router = express.Router();
const ejercicioController = require('../controllers/ejercicio.controller');

router.post('/', ejercicioController.createEjercicio);
router.get('/', ejercicioController.getEjercicios);

module.exports = router;
