const express = require("express");
const {
  crearDocente,
  obtenerDocentes,
  obtenerDocentePorId,
  actualizarDocente,
  eliminarDocente,
} = require("../controllers/docente.controller");
const progresoController = require("../controllers/progreso.controller");
const autenticacionUsuario = require("../middlewares/autenticacionUsuario");
const requiereDocente = require("../middlewares/requiereDocente");

const { loginDocente } = require("../controllers/auth.controller");

const router = express.Router();

router.post("/", crearDocente);
router.post("/login", loginDocente);
router.get("/", obtenerDocentes);
router.get(
  "/reportes/progreso-estudiantes",
  autenticacionUsuario,
  requiereDocente,
  progresoController.obtenerResumenGeneralDocente
);
router.get(
  "/reportes/fallos",
  autenticacionUsuario,
  requiereDocente,
  progresoController.obtenerReporteFallosDocente
);
router.get("/:id", obtenerDocentePorId);
router.put("/:id", actualizarDocente);
router.delete("/:id", eliminarDocente);

module.exports = router;
