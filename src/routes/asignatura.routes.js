const express = require('express');
const router = express.Router();
const AsignaturaController = require('../controllers/asignatura.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const requiereAdmin = require('../middlewares/requiereAdmin');
const requiereDocente = require('../middlewares/requiereDocente');

// Estadísticas macro del panel de administración (COUNT directo, sin cargar filas)
router.get('/admin/stats', autenticacionUsuario, requiereAdmin, AsignaturaController.getAdminStats);

// Definición de rutas CRUD
// POST, PUT, DELETE: requieren ser ADMINISTRADOR
router.post('/', autenticacionUsuario, requiereAdmin, AsignaturaController.createAsignatura);
// GET: permite lectura si está autenticado
router.get('/', autenticacionUsuario, AsignaturaController.getAsignaturas);
router.get('/mis-asignaturas', autenticacionUsuario, requiereDocente, AsignaturaController.getMisAsignaturasDocente);
router.patch(
  '/:id/progresion-secuencial',
  autenticacionUsuario,
  AsignaturaController.patchProgresionSecuencial
);
router.get('/:id', autenticacionUsuario, AsignaturaController.getAsignaturaById);
// PUT, DELETE: requieren ser ADMINISTRADOR
router.put('/:id', autenticacionUsuario, requiereAdmin, AsignaturaController.updateAsignatura);
router.put('/:id/toggle-estado', autenticacionUsuario, requiereAdmin, AsignaturaController.toggleEstadoAsignatura);
router.delete('/:id', autenticacionUsuario, requiereAdmin, AsignaturaController.deleteAsignatura);

module.exports = router;
