
const express = require('express');
const router = express.Router();
const controller = require('../controllers/miniproyecto.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const autorizacionDocente = require('../middlewares/autorizacionDocente');

router.post('/', autenticacionUsuario, autorizacionDocente, controller.create);
router.get('/:id/configurable-progress', autenticacionUsuario, controller.obtenerProgresoConfigurable);
router.post('/:id/evaluar-configurable', autenticacionUsuario, controller.evaluarMiniproyectoConfigurable);
router.get('/:id/ejercicios/:exerciseKey/retroalimentacion', autenticacionUsuario, controller.obtenerRetroalimentacionEjercicioConfigurable);
router.post('/:id/ejercicios/:exerciseKey/resolver', autenticacionUsuario, controller.ejecutarEjercicioConfigurable);
router.post('/:id/ejercicios/:exerciseKey/enviar', autenticacionUsuario, controller.enviarEjercicioConfigurable);
router.post('/:id/ejecutar', autenticacionUsuario, controller.ejecutarMiniproyectoProgramacion);
router.post('/:id/enviar', autenticacionUsuario, controller.enviarMiniproyectoProgramacion);
router.put('/:id/publicacion-estudiante', autenticacionUsuario, autorizacionDocente, controller.updateStudentPublication);
router.get('/', autenticacionUsuario, controller.findAll);
router.get('/:id', autenticacionUsuario, controller.findOne);
router.put('/:id/toggle-estado', autenticacionUsuario, autorizacionDocente, controller.toggleEstado);
router.put('/:id', autenticacionUsuario, autorizacionDocente, controller.update);
router.delete('/:id', autenticacionUsuario, autorizacionDocente, controller.delete);

module.exports = router;
