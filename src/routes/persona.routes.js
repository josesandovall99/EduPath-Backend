const express = require("express");
const {
  crearPersona,
  obtenerPersonas,
  obtenerPersonaPorId,
  actualizarPersona,
  eliminarPersona,
} = require("../controllers/persona.controller");

const router = express.Router();

router.post("/", crearPersona);
router.get("/", obtenerPersonas);
router.get("/:id", obtenerPersonaPorId);
router.put("/:id", actualizarPersona);
router.delete("/:id", eliminarPersona);

module.exports = router;
