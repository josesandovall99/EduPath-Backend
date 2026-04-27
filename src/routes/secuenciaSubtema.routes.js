const express = require('express');
const router = express.Router();
const secuenciaSubtemaController = require('../controllers/secuenciaSubtema.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const requiereAdminODocente = require('../middlewares/requiereAdminODocente');

// Crear una nueva secuencia de subtema
router.post('/', autenticacionUsuario, requiereAdminODocente, secuenciaSubtemaController.createSecuenciaSubtema);

// Listar todas las secuencias de subtema (lectura: el estudiante necesita esto para ver el orden)
router.get('/', autenticacionUsuario, secuenciaSubtemaController.getSecuenciasSubtema);

// Obtener subtemas ordenados por secuencia de un tema (lectura: el estudiante necesita esto)
router.get('/tema/:temaId/ordenados', autenticacionUsuario, secuenciaSubtemaController.getSubtemasOrdenadosPorSecuencia);

// Obtener una secuencia de subtema por ID (lectura: accesible a cualquier usuario autenticado)
router.get('/:id', autenticacionUsuario, secuenciaSubtemaController.getSecuenciaSubtemaById);

// Actualizar una secuencia de subtema
router.put('/:id', autenticacionUsuario, requiereAdminODocente, secuenciaSubtemaController.updateSecuenciaSubtema);

// Habilitar o inhabilitar una secuencia de subtema (Toggle)
router.patch('/:id/estado', autenticacionUsuario, requiereAdminODocente, secuenciaSubtemaController.toggleEstadoSecuenciaSubtema);

// Reorganizar secuencias (drag & drop)
router.post('/reorder', autenticacionUsuario, requiereAdminODocente, secuenciaSubtemaController.reorderSequences);

// Eliminar una secuencia de subtema
router.delete('/:id', autenticacionUsuario, requiereAdminODocente, secuenciaSubtemaController.deleteSecuenciaSubtema);

module.exports = router;
