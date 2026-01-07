const express = require('express');
const router = express.Router();
const temaController = require('../controllers/tema.controller');

// Definición de rutas CRUD
router.post('/', temaController.createTema);
router.get('/', temaController.getTemas);
router.get('/por-area/:areaId', temaController.getTemasByArea);
router.get('/:id', temaController.getTemaById);
router.put('/:id', temaController.updateTema);
router.delete('/:id', temaController.deleteTema);

module.exports = router;
