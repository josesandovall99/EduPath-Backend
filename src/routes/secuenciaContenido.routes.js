const express = require('express');
const router = express.Router();
const secuenciaContenidoController = require('../controllers/secuenciaContenido.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const requiereAdmin = require('../middlewares/requiereAdmin');

// Crear una nueva secuencia de contenido
router.post('/', autenticacionUsuario, requiereAdmin, secuenciaContenidoController.createSecuenciaContenido);

// Listar todas las secuencias de contenido
router.get('/', autenticacionUsuario, secuenciaContenidoController.getSecuenciasContenido);

// Obtener contenidos ordenados por secuencia de un subtema
router.get('/subtema/:subtemaId/ordenados', autenticacionUsuario, secuenciaContenidoController.getContenidosOrdenadosPorSecuencia);

// Obtener una secuencia de contenido por ID
router.get('/:id', autenticacionUsuario, secuenciaContenidoController.getSecuenciaContenidoById);

// Actualizar una secuencia de contenido
router.put('/:id', autenticacionUsuario, requiereAdmin, secuenciaContenidoController.updateSecuenciaContenido);

// Habilitar o inhabilitar una secuencia de contenido (Toggle)
router.patch('/:id/estado', autenticacionUsuario, requiereAdmin, secuenciaContenidoController.toggleEstadoSecuenciaContenido);

// 🆕 Reorganizar secuencias completas (drag & drop)
router.post('/reorder', autenticacionUsuario, requiereAdmin, secuenciaContenidoController.reorderSequences);

// Eliminar una secuencia de contenido
router.delete('/:id', autenticacionUsuario, requiereAdmin, secuenciaContenidoController.deleteSecuenciaContenido);

module.exports = router;