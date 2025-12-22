const express = require("express");
const {
  crearRespuestaMiniproyecto,
  obtenerRespuestasMiniproyecto,
  obtenerRespuestaMiniproyectoPorId,
  actualizarRespuestaMiniproyecto,
  eliminarRespuestaMiniproyecto,
} = require(
  "../controllers/respuestasEstudianteMiniproyecto.controller"
);

const router = express.Router();

router.post("/", crearRespuestaMiniproyecto);
router.get("/", obtenerRespuestasMiniproyecto);
router.get("/:id", obtenerRespuestaMiniproyectoPorId);
router.put("/:id", actualizarRespuestaMiniproyecto);
router.delete("/:id", eliminarRespuestaMiniproyecto);

module.exports = router;
