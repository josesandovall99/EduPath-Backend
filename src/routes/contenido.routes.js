const express = require('express');
const router = express.Router();
const contenidoController = require('../controllers/contenido.controller');

// Definición de rutas CRUD - Rutas específicas ANTES de rutas con parámetros
router.post('/', contenidoController.createContenido);
router.get('/', contenidoController.getContenidos);
router.post('/marcar-visualizado', contenidoController.marcarContenidoVisualizado);
router.get('/verificar-visualizacion', contenidoController.obtenerEstadoVisualizacion);
router.put('/:id/toggle-estado', contenidoController.toggleEstadoContenido);
router.get('/subtema/:subtemaId', contenidoController.getContenidosPorSubtema);
router.get('/categoria/:categoria', contenidoController.getContenidosPorCategoria);
router.get('/area/nombre/:nombreArea', contenidoController.getContenidosPorAreaNombre);
router.get('/adaptado/estudiante/:estudianteId', contenidoController.adaptarContenidoPorPerfil);
router.get('/:id', contenidoController.getContenidoById);
router.put('/:id', contenidoController.updateContenido);
router.delete('/:id', contenidoController.deleteContenido);

module.exports = router;
