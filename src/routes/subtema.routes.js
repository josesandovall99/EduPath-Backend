const express = require('express');
const router = express.Router();
const subtemaController = require('../controllers/subtema.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const autorizacionDocente = require('../middlewares/autorizacionDocente');

// Definición de rutas CRUD
router.post('/', autenticacionUsuario, autorizacionDocente, subtemaController.createSubtema);
router.get('/', autenticacionUsuario, subtemaController.getSubtemas);
router.get('/por-tema/:temaId', autenticacionUsuario, subtemaController.getSubtemasByTema);
router.get('/:id', autenticacionUsuario, subtemaController.getSubtemaById);
router.put('/:id/toggle-estado', autenticacionUsuario, autorizacionDocente, subtemaController.toggleEstadoSubtema);
router.put('/:id', autenticacionUsuario, autorizacionDocente, subtemaController.updateSubtema);
router.delete('/:id', autenticacionUsuario, autorizacionDocente, subtemaController.deleteSubtema);

module.exports = router;
