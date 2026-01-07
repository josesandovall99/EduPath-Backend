const express = require('express');
const router = express.Router();
const subtemaController = require('../controllers/subtema.controller');

// Definición de rutas CRUD
router.post('/', subtemaController.createSubtema);
router.get('/', subtemaController.getSubtemas);
router.get('/por-tema/:temaId', subtemaController.getSubtemasByTema);
router.get('/:id', subtemaController.getSubtemaById);
router.put('/:id', subtemaController.updateSubtema);
router.delete('/:id', subtemaController.deleteSubtema);

module.exports = router;
