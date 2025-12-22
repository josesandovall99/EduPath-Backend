const express = require("express");
const {
  crearRespuestaEjercicio,
  obtenerRespuestasEjercicio,
  obtenerRespuestaEjercicioPorId,
  actualizarRespuestaEjercicio,
  eliminarRespuestaEjercicio,
} = require(
  "../controllers/respuestaEstudianteEjercicio.controller"
);

const router = express.Router();

router.post("/", crearRespuestaEjercicio);
router.get("/", obtenerRespuestasEjercicio);
router.get("/:id", obtenerRespuestaEjercicioPorId);
router.put("/:id", actualizarRespuestaEjercicio);
router.delete("/:id", eliminarRespuestaEjercicio);

module.exports = router;
