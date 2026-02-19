const express = require('express');
const router = express.Router();
const ejercicioController = require('../controllers/ejercicio.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const autorizacionDocente = require('../middlewares/autorizacionDocente');

// CRUD básico
router.post('/', autenticacionUsuario, autorizacionDocente, ejercicioController.createEjercicio);
router.get('/', autenticacionUsuario, ejercicioController.getEjercicios);
router.get('/:id', autenticacionUsuario, ejercicioController.getEjercicioById);
router.put('/:id', autenticacionUsuario, autorizacionDocente, ejercicioController.updateEjercicio);
router.delete('/:id', autenticacionUsuario, autorizacionDocente, ejercicioController.deleteEjercicio);

// Funcionalidades específicas de ejercicios
router.post('/:ejercicioId/resolver', ejercicioController.resolverEjercicio);
router.post('/:ejercicioId/enviar', ejercicioController.enviarRespuestaEjercicio);
router.get('/:ejercicioId/retroalimentacion', ejercicioController.getRetroalimentacionEjercicio);

module.exports = router;
