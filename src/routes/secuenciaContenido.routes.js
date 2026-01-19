const express = require('express');
const router = express.Router();
const secuenciaContenidoController = require('../controllers/secuenciaContenido.controller');

// Crear una nueva secuencia de contenido
router.post('/', secuenciaContenidoController.createSecuenciaContenido);

// Listar todas las secuencias de contenido
router.get('/', secuenciaContenidoController.getSecuenciasContenido);

// Obtener contenidos ordenados por secuencia de un subtema
router.get('/subtema/:subtemaId/ordenados', secuenciaContenidoController.getContenidosOrdenadosPorSecuencia);

// Obtener una secuencia de contenido por ID
router.get('/:id', secuenciaContenidoController.getSecuenciaContenidoById);

// Actualizar una secuencia de contenido
router.put('/:id', secuenciaContenidoController.updateSecuenciaContenido);

// Habilitar o inhabilitar una secuencia de contenido (Toggle)
router.patch('/:id/estado', secuenciaContenidoController.toggleEstadoSecuenciaContenido);

// 🆕 Reorganizar secuencias completas (drag & drop)
router.post('/reorder', secuenciaContenidoController.reorderSequences);

// Eliminar una secuencia de contenido
router.delete('/:id', secuenciaContenidoController.deleteSecuenciaContenido);

module.exports = router;