const express = require("express");
const {
  crearEstudiante,
  obtenerEstudiantes,
  obtenerEstudiantePorId,
  actualizarEstudiante,
  eliminarEstudiante,
} = require("../controllers/estudiante.controller");

const router = express.Router();

router.post("/", crearEstudiante);
router.get("/", obtenerEstudiantes);
router.get("/:id", obtenerEstudiantePorId);
router.put("/:id", actualizarEstudiante);
router.delete("/:id", eliminarEstudiante);

module.exports = router;
