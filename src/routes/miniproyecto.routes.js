
const express = require('express');
const router = express.Router();
const controller = require('../controllers/miniproyecto.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const autorizacionDocente = require('../middlewares/autorizacionDocente');

router.post('/', autenticacionUsuario, autorizacionDocente, controller.create);
router.post('/:id/ejecutar', autenticacionUsuario, controller.ejecutarMiniproyectoProgramacion);
router.post('/:id/enviar', autenticacionUsuario, controller.enviarMiniproyectoProgramacion);
router.get('/', autenticacionUsuario, controller.findAll);
router.get('/:id', autenticacionUsuario, controller.findOne);
router.put('/:id/toggle-estado', autenticacionUsuario, autorizacionDocente, controller.toggleEstado);
router.put('/:id', autenticacionUsuario, autorizacionDocente, controller.update);
router.delete('/:id', autenticacionUsuario, autorizacionDocente, controller.delete);

module.exports = router;
