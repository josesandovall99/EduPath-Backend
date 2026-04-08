const router = require('express').Router();
const controller = require('../controllers/evaluacion.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');

router.post('/', autenticacionUsuario, controller.create);
router.post('/compilador', autenticacionUsuario, controller.evaluarCompilador);
router.get('/', autenticacionUsuario, controller.findAll);
router.get('/by', autenticacionUsuario, controller.findBy);
router.get('/:id', autenticacionUsuario, controller.findOne);
router.put('/:id', autenticacionUsuario, controller.update);
router.delete('/:id', autenticacionUsuario, controller.delete);

module.exports = router;