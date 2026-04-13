const express = require('express');
const router = express.Router();
const areaController = require('../controllers/area.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const requiereAdmin = require('../middlewares/requiereAdmin');
const requiereDocente = require('../middlewares/requiereDocente');

// Definición de rutas CRUD
// POST, PUT, DELETE: requieren ser ADMINISTRADOR
router.post('/', autenticacionUsuario, requiereAdmin, areaController.createArea);
// GET: permite lectura si está autenticado
router.get('/', autenticacionUsuario, areaController.getAreas);
router.get('/mis-areas', autenticacionUsuario, requiereDocente, areaController.getMisAreasDocente);
router.get('/:id', autenticacionUsuario, areaController.getAreaById);
// PUT, DELETE: requieren ser ADMINISTRADOR
router.put('/:id', autenticacionUsuario, requiereAdmin, areaController.updateArea);
router.put('/:id/toggle-estado', autenticacionUsuario, requiereAdmin, areaController.toggleEstadoArea);
router.delete('/:id', autenticacionUsuario, requiereAdmin, areaController.deleteArea);

module.exports = router;
