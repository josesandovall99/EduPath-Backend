const express = require('express');
const router = express.Router();
const areaController = require('../controllers/area.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const requiereAdmin = require('../middlewares/requiereAdmin');

// Definición de rutas CRUD
// POST, PUT, DELETE: requieren ser ADMINISTRADOR
router.post('/', autenticacionUsuario, requiereAdmin, areaController.createArea);
// GET: permite lectura si está autenticado
router.get('/', autenticacionUsuario, areaController.getAreas);
router.get('/:id', autenticacionUsuario, areaController.getAreaById);
// PUT, DELETE: requieren ser ADMINISTRADOR
router.put('/:id', autenticacionUsuario, requiereAdmin, areaController.updateArea);
router.delete('/:id', autenticacionUsuario, requiereAdmin, areaController.deleteArea);

module.exports = router;
