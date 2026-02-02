const router = require('express').Router();
const controller = require('../controllers/progreso.controller');

router.post('/', controller.create);
router.get('/calificacion-estimada', controller.getCalificacionEstimada);
router.get('/resumen-general', controller.obtenerResumenGeneralEstudiantes);
router.get('/reporte-pdf', controller.generarPdfReporte);
router.get('/por-area', controller.obtenerProgresoEstudiantePorArea);
router.get('/por-tema', controller.obtenerProgresoEstudiantePorTema);
router.get('/por-subtema', controller.obtenerProgresoEstudiantePorSubtema);
router.get('/resumen-unidad', controller.obtenerResumenUnidadEstudiante);

// Rutas de desbloqueo y estado
router.get('/verificar-contenido-desbloqueado', controller.verificarContenidoDesbloqueado);
router.get('/verificar-subtema-completo', controller.verificarSubtemaCompleto);
router.get('/verificar-tema-completo', controller.verificarTemaCompleto);
router.get('/estado-contenidos-tema', controller.obtenerEstadoContenidosTema);
router.get('/estado-subtemas-tema', controller.obtenerEstadoSubtemasTema);
router.get('/estado-temas-area', controller.obtenerEstadoTemasArea);
router.get('/siguiente-contenido', controller.obtenerSiguienteContenido);

router.get('/', controller.findAll);
router.get('/:id', controller.findOne);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;

