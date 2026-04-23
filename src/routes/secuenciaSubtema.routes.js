const express = require('express');
const router = express.Router();
const secuenciaSubtemaController = require('../controllers/secuenciaSubtema.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const requiereAdminODocente = require('../middlewares/requiereAdminODocente');

// Crear una nueva secuencia de subtema
router.post('/', autenticacionUsuario, requiereAdminODocente, secuenciaSubtemaController.createSecuenciaSubtema);

// Listar todas las secuencias de subtema
router.get('/', autenticacionUsuario, requiereAdminODocente, secuenciaSubtemaController.getSecuenciasSubtema);

// Obtener subtemas ordenados por secuencia de un tema
router.get('/tema/:temaId/ordenados', autenticacionUsuario, requiereAdminODocente, secuenciaSubtemaController.getSubtemasOrdenadosPorSecuencia);

// Obtener una secuencia de subtema por ID
router.get('/:id', autenticacionUsuario, requiereAdminODocente, secuenciaSubtemaController.getSecuenciaSubtemaById);

// Actualizar una secuencia de subtema
router.put('/:id', autenticacionUsuario, requiereAdminODocente, secuenciaSubtemaController.updateSecuenciaSubtema);

// Habilitar o inhabilitar una secuencia de subtema (Toggle)
router.patch('/:id/estado', autenticacionUsuario, requiereAdminODocente, secuenciaSubtemaController.toggleEstadoSecuenciaSubtema);

// Reorganizar secuencias (drag & drop)
router.post('/reorder', autenticacionUsuario, requiereAdminODocente, secuenciaSubtemaController.reorderSequences);

// Eliminar una secuencia de subtema
router.delete('/:id', autenticacionUsuario, requiereAdminODocente, secuenciaSubtemaController.deleteSecuenciaSubtema);

module.exports = router;
