const express = require('express');
const router = express.Router();
const secuenciaContenidoController = require('../controllers/secuenciaContenido.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const requiereAdminODocente = require('../middlewares/requiereAdminODocente');

// Crear una nueva secuencia de contenido
router.post('/', autenticacionUsuario, requiereAdminODocente, secuenciaContenidoController.createSecuenciaContenido);

// Listar todas las secuencias de contenido (lectura: estudiante necesita esto para ver el orden)
router.get('/', autenticacionUsuario, secuenciaContenidoController.getSecuenciasContenido);

// Obtener contenidos ordenados por secuencia de un subtema (lectura: estudiante necesita esto)
router.get('/subtema/:subtemaId/ordenados', autenticacionUsuario, secuenciaContenidoController.getContenidosOrdenadosPorSecuencia);

// Obtener el contexto de creación de secuencias para un subtema (solo docente/admin)
router.get('/subtema/:subtemaId/contexto-creacion', autenticacionUsuario, requiereAdminODocente, secuenciaContenidoController.getSecuenciaContenidoCreationContext);

// Obtener una secuencia de contenido por ID (lectura: accesible autenticado)
router.get('/:id', autenticacionUsuario, secuenciaContenidoController.getSecuenciaContenidoById);

// Actualizar una secuencia de contenido
router.put('/:id', autenticacionUsuario, requiereAdminODocente, secuenciaContenidoController.updateSecuenciaContenido);

// Habilitar o inhabilitar una secuencia de contenido (Toggle)
router.patch('/:id/estado', autenticacionUsuario, requiereAdminODocente, secuenciaContenidoController.toggleEstadoSecuenciaContenido);

// 🆕 Reorganizar secuencias completas (drag & drop)
router.post('/reorder', autenticacionUsuario, requiereAdminODocente, secuenciaContenidoController.reorderSequences);

// Eliminar una secuencia de contenido
router.delete('/:id', autenticacionUsuario, requiereAdminODocente, secuenciaContenidoController.deleteSecuenciaContenido);

module.exports = router;