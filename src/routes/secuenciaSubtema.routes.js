const express = require('express');
const router = express.Router();
const secuenciaSubtemaController = require('../controllers/secuenciaSubtema.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const requiereAdmin = require('../middlewares/requiereAdmin');

// Crear una nueva secuencia de subtema
router.post('/', autenticacionUsuario, requiereAdmin, secuenciaSubtemaController.createSecuenciaSubtema);

// Listar todas las secuencias de subtema
router.get('/', autenticacionUsuario, secuenciaSubtemaController.getSecuenciasSubtema);

// Obtener subtemas ordenados por secuencia de un tema
router.get('/tema/:temaId/ordenados', autenticacionUsuario, secuenciaSubtemaController.getSubtemasOrdenadosPorSecuencia);

// Obtener una secuencia de subtema por ID
router.get('/:id', autenticacionUsuario, secuenciaSubtemaController.getSecuenciaSubtemaById);

// Actualizar una secuencia de subtema
router.put('/:id', autenticacionUsuario, requiereAdmin, secuenciaSubtemaController.updateSecuenciaSubtema);

// Habilitar o inhabilitar una secuencia de subtema (Toggle)
router.patch('/:id/estado', autenticacionUsuario, requiereAdmin, secuenciaSubtemaController.toggleEstadoSecuenciaSubtema);

// Reorganizar secuencias (drag & drop)
router.post('/reorder', autenticacionUsuario, requiereAdmin, secuenciaSubtemaController.reorderSequences);

// Eliminar una secuencia de subtema
router.delete('/:id', autenticacionUsuario, requiereAdmin, secuenciaSubtemaController.deleteSecuenciaSubtema);

module.exports = router;
