const express = require('express');
const router = express.Router();
const secuenciaContenidoController = require('../controllers/secuenciaContenido.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const requiereAdminODocente = require('../middlewares/requiereAdminODocente');

// Crear una nueva secuencia de contenido
router.post('/', autenticacionUsuario, requiereAdminODocente, secuenciaContenidoController.createSecuenciaContenido);

// Listar todas las secuencias de contenido
router.get('/', autenticacionUsuario, requiereAdminODocente, secuenciaContenidoController.getSecuenciasContenido);

// Obtener contenidos ordenados por secuencia de un subtema
router.get('/subtema/:subtemaId/ordenados', autenticacionUsuario, requiereAdminODocente, secuenciaContenidoController.getContenidosOrdenadosPorSecuencia);

// Obtener el contexto de creación de secuencias para un subtema
router.get('/subtema/:subtemaId/contexto-creacion', autenticacionUsuario, requiereAdminODocente, secuenciaContenidoController.getSecuenciaContenidoCreationContext);

// Obtener una secuencia de contenido por ID
router.get('/:id', autenticacionUsuario, requiereAdminODocente, secuenciaContenidoController.getSecuenciaContenidoById);

// Actualizar una secuencia de contenido
router.put('/:id', autenticacionUsuario, requiereAdminODocente, secuenciaContenidoController.updateSecuenciaContenido);

// Habilitar o inhabilitar una secuencia de contenido (Toggle)
router.patch('/:id/estado', autenticacionUsuario, requiereAdminODocente, secuenciaContenidoController.toggleEstadoSecuenciaContenido);

// 🆕 Reorganizar secuencias completas (drag & drop)
router.post('/reorder', autenticacionUsuario, requiereAdminODocente, secuenciaContenidoController.reorderSequences);

// Eliminar una secuencia de contenido
router.delete('/:id', autenticacionUsuario, requiereAdminODocente, secuenciaContenidoController.deleteSecuenciaContenido);

module.exports = router;