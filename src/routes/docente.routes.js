const express = require("express");
const {
  crearDocente,
  obtenerDocentes,
  obtenerDocentePorId,
  actualizarDocente,
  eliminarDocente,
} = require("../controllers/docente.controller");

const { loginDocente } = require("../controllers/auth.controller");

const router = express.Router();

router.post("/", crearDocente);
router.post("/login", loginDocente);
router.get("/", obtenerDocentes);
router.get("/:id", obtenerDocentePorId);
router.put("/:id", actualizarDocente);
router.delete("/:id", eliminarDocente);

module.exports = router;
