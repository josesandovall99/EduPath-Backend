const express = require('express');
const router = express.Router();
const contenidoController = require('../controllers/contenido.controller');

// Definición de rutas CRUD
router.post('/', contenidoController.createContenido);
router.get('/', contenidoController.getContenidos);
router.get('/:id', contenidoController.getContenidoById);
router.put('/:id', contenidoController.updateContenido);
router.delete('/:id', contenidoController.deleteContenido);
router.get('/subtema/:subtemaId', contenidoController.getContenidosPorSubtema);


module.exports = router;
