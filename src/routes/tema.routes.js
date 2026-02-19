const express = require('express');
const router = express.Router();
const temaController = require('../controllers/tema.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const autorizacionDocente = require('../middlewares/autorizacionDocente');

// Definición de rutas CRUD
router.post('/', autenticacionUsuario, autorizacionDocente, temaController.createTema);
router.get('/', autenticacionUsuario, temaController.getTemas);
router.get('/por-area/:areaId', autenticacionUsuario, temaController.getTemasByArea);
router.get('/:id', autenticacionUsuario, temaController.getTemaById);
router.put('/reordenar', autorizacionDocente, temaController.reordenarTemas);
router.put('/:id', autorizacionDocente, temaController.updateTema);
router.delete('/:id', autorizacionDocente, temaController.deleteTema);

module.exports = router;
