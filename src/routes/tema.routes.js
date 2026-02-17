const express = require('express');
const router = express.Router();
const temaController = require('../controllers/tema.controller');
const autorizacionDocente = require('../middlewares/autorizacionDocente');

// Definición de rutas CRUD
router.post('/', autorizacionDocente, temaController.createTema);
router.get('/', temaController.getTemas);
router.get('/por-area/:areaId', temaController.getTemasByArea);
router.get('/:id', temaController.getTemaById);
router.put('/reordenar', autorizacionDocente, temaController.reordenarTemas);
router.put('/:id', autorizacionDocente, temaController.updateTema);
router.delete('/:id', autorizacionDocente, temaController.deleteTema);

module.exports = router;
