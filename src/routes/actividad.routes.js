const router = require('express').Router();
const controller = require('../controllers/actividad.controller');

router.post('/', controller.create);
router.get('/', controller.findAll);
router.get('/:id', controller.findOne);
router.put('/:id/toggle-estado', controller.toggleEstado);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;
