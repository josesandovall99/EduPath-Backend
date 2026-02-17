
const express = require('express');
const router = express.Router();
const controller = require('../controllers/miniproyecto.controller');
const autorizacionDocente = require('../middlewares/autorizacionDocente');

router.post('/', autorizacionDocente, controller.create);
router.post('/:id/enviar', controller.enviarMiniproyectoProgramacion);
router.get('/', controller.findAll);
router.get('/:id', controller.findOne);
router.put('/:id', autorizacionDocente, controller.update);
router.delete('/:id', autorizacionDocente, controller.delete);

module.exports = router;
