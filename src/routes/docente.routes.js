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
const requiereAdmin = require('../middlewares/requiereAdmin');
const { loginRateLimit } = require('../middlewares/authRateLimit');

const { loginDocente } = require("../controllers/auth.controller");

const router = express.Router();

router.post("/", autenticacionUsuario, requiereAdmin, crearDocente);
router.post("/login", loginRateLimit, loginDocente);
router.get("/", autenticacionUsuario, requiereAdmin, obtenerDocentes);
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
router.get("/:id", autenticacionUsuario, requiereAdmin, obtenerDocentePorId);
router.put("/:id", autenticacionUsuario, requiereAdmin, actualizarDocente);
router.delete("/:id", autenticacionUsuario, requiereAdmin, eliminarDocente);

module.exports = router;
