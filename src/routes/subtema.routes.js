const express = require('express');
const router = express.Router();
const subtemaController = require('../controllers/subtema.controller');
const autorizacionDocente = require('../middlewares/autorizacionDocente');

// Definición de rutas CRUD
router.post('/', autorizacionDocente, subtemaController.createSubtema);
router.get('/', subtemaController.getSubtemas);
router.get('/por-tema/:temaId', subtemaController.getSubtemasByTema);
router.get('/:id', subtemaController.getSubtemaById);
router.put('/:id', autorizacionDocente, subtemaController.updateSubtema);
router.delete('/:id', autorizacionDocente, subtemaController.deleteSubtema);

module.exports = router;
