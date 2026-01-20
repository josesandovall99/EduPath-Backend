const express = require("express");
const {
  crearRespuestaMiniproyecto,
  obtenerRespuestasMiniproyecto,
  obtenerRespuestaMiniproyectoPorId,
  actualizarRespuestaMiniproyecto,
  eliminarRespuestaMiniproyecto,
  verificarMiniproyectoCompletado,
} = require(
  "../controllers/respuestasEstudianteMiniproyecto.controller"
);

const router = express.Router();

router.post("/", crearRespuestaMiniproyecto);
router.get("/verificar-completado", verificarMiniproyectoCompletado);
router.get("/", obtenerRespuestasMiniproyecto);
router.get("/:id", obtenerRespuestaMiniproyectoPorId);
router.put("/:id", actualizarRespuestaMiniproyecto);
router.delete("/:id", eliminarRespuestaMiniproyecto);

module.exports = router;
