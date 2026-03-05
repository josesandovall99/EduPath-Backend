const router = require('express').Router();
const controller = require('../controllers/progreso.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const requiereDocente = require('../middlewares/requiereDocente');
const requiereAdminODocente = require('../middlewares/requiereAdminODocente');

router.post('/', autenticacionUsuario, controller.create);
router.get('/calificacion-estimada', autenticacionUsuario, controller.getCalificacionEstimada);
router.get('/resumen-general', autenticacionUsuario, requiereAdminODocente, controller.obtenerResumenGeneralEstudiantes);
router.get('/reporte-fallos', autenticacionUsuario, requiereAdminODocente, controller.obtenerReporteFallos);
router.get('/reporte-pdf', autenticacionUsuario, requiereAdminODocente, controller.generarPdfReporte);
router.get('/por-area', autenticacionUsuario, controller.obtenerProgresoEstudiantePorArea);
router.get('/por-tema', autenticacionUsuario, controller.obtenerProgresoEstudiantePorTema);
router.get('/por-subtema', autenticacionUsuario, controller.obtenerProgresoEstudiantePorSubtema);
router.get('/resumen-unidad', autenticacionUsuario, controller.obtenerResumenUnidadEstudiante);

// Rutas de desbloqueo y estado
router.get('/verificar-contenido-desbloqueado', autenticacionUsuario, controller.verificarContenidoDesbloqueado);
router.get('/verificar-subtema-completo', autenticacionUsuario, controller.verificarSubtemaCompleto);
router.get('/verificar-tema-completo', autenticacionUsuario, controller.verificarTemaCompleto);
router.get('/estado-contenidos-tema', autenticacionUsuario, controller.obtenerEstadoContenidosTema);
router.get('/estado-subtemas-tema', autenticacionUsuario, controller.obtenerEstadoSubtemasTema);
router.get('/estado-temas-area', autenticacionUsuario, controller.obtenerEstadoTemasArea);
router.get('/siguiente-contenido', autenticacionUsuario, controller.obtenerSiguienteContenido);

router.get('/', autenticacionUsuario, controller.findAll);
router.get('/:id', autenticacionUsuario, controller.findOne);
router.put('/:id', autenticacionUsuario, controller.update);
router.delete('/:id', autenticacionUsuario, controller.delete);

module.exports = router;

