const express = require('express');
const router = express.Router();
const secuenciaSubtemaController = require('../controllers/secuenciaSubtema.controller');

// Crear una nueva secuencia de subtema
router.post('/', secuenciaSubtemaController.createSecuenciaSubtema);

// Listar todas las secuencias de subtema
router.get('/', secuenciaSubtemaController.getSecuenciasSubtema);

// Obtener subtemas ordenados por secuencia de un tema
router.get('/tema/:temaId/ordenados', secuenciaSubtemaController.getSubtemasOrdenadosPorSecuencia);

// Obtener una secuencia de subtema por ID
router.get('/:id', secuenciaSubtemaController.getSecuenciaSubtemaById);

// Actualizar una secuencia de subtema
router.put('/:id', secuenciaSubtemaController.updateSecuenciaSubtema);

// Habilitar o inhabilitar una secuencia de subtema (Toggle)
router.patch('/:id/estado', secuenciaSubtemaController.toggleEstadoSecuenciaSubtema);

// Reorganizar secuencias (drag & drop)
router.post('/reorder', secuenciaSubtemaController.reorderSequences);

// Eliminar una secuencia de subtema
router.delete('/:id', secuenciaSubtemaController.deleteSecuenciaSubtema);

module.exports = router;
