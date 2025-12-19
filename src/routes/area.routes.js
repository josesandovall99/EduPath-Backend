const express = require('express');
const router = express.Router();
const areaController = require('../controllers/area.controller');

// Definición de rutas CRUD
router.post('/', areaController.createArea);
router.get('/', areaController.getAreas);
router.get('/:id', areaController.getAreaById);
router.put('/:id', areaController.updateArea);
router.delete('/:id', areaController.deleteArea);

module.exports = router;
