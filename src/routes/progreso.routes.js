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
router.get('/', controller.findAll);
router.get('/:id', controller.findOne);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;
