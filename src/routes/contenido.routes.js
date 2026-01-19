const express = require('express');
const router = express.Router();
const contenidoController = require('../controllers/contenido.controller');

// Definición de rutas CRUD
router.post('/', contenidoController.createContenido);
router.get('/', contenidoController.getContenidos);
router.get('/:id', contenidoController.getContenidoById);
router.put('/:id', contenidoController.updateContenido);
router.delete('/:id', contenidoController.deleteContenido);
router.put('/:id/toggle-estado', contenidoController.toggleEstadoContenido);
router.get('/subtema/:subtemaId', contenidoController.getContenidosPorSubtema);
router.get('/categoria/:categoria', contenidoController.getContenidosPorCategoria);
router.get('/area/nombre/:nombreArea', contenidoController.getContenidosPorAreaNombre);
router.get('/adaptado/estudiante/:estudianteId', contenidoController.adaptarContenidoPorPerfil);


module.exports = router;
