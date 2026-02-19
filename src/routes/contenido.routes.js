const express = require('express');
const router = express.Router();
const contenidoController = require('../controllers/contenido.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const autorizacionDocente = require('../middlewares/autorizacionDocente');

// Definición de rutas CRUD - Rutas específicas ANTES de rutas con parámetros
router.post('/', autenticacionUsuario, autorizacionDocente, contenidoController.createContenido);
router.get('/', autenticacionUsuario, contenidoController.getContenidos);
router.post('/marcar-visualizado', autenticacionUsuario, autorizacionDocente, contenidoController.marcarContenidoVisualizado);
router.get('/verificar-visualizacion', autenticacionUsuario, contenidoController.obtenerEstadoVisualizacion);
router.put('/:id/toggle-estado', autenticacionUsuario, autorizacionDocente, contenidoController.toggleEstadoContenido);
router.get('/subtema/:subtemaId', autenticacionUsuario, contenidoController.getContenidosPorSubtema);
router.get('/categoria/:categoria', autenticacionUsuario, contenidoController.getContenidosPorCategoria);
router.get('/area/nombre/:nombreArea', autenticacionUsuario, contenidoController.getContenidosPorAreaNombre);
router.get('/adaptado/estudiante/:estudianteId', contenidoController.adaptarContenidoPorPerfil);
router.get('/:id', autenticacionUsuario, contenidoController.getContenidoById);
router.put('/:id', autenticacionUsuario, autorizacionDocente, contenidoController.updateContenido);
router.delete('/:id', autenticacionUsuario, autorizacionDocente, contenidoController.deleteContenido);

module.exports = router;
