const express = require("express");
const {
  crearPersona,
  obtenerPersonas,
  obtenerPersonaPorId,
  actualizarPersona,
  eliminarPersona,
} = require("../controllers/persona.controller");
const {
  solicitarResetPassword,
  resetPassword,
  cambiarContraseñaPrimerIngreso
} = require("../controllers/auth.controller");

const router = express.Router();

router.post("/", crearPersona);
router.post("/forgot-password", solicitarResetPassword);
router.post("/reset-password", resetPassword);
router.post("/cambiar-password-inicial", cambiarContraseñaPrimerIngreso);
router.get("/", obtenerPersonas);
router.get("/:id", obtenerPersonaPorId);
router.put("/:id", actualizarPersona);
router.delete("/:id", eliminarPersona);

module.exports = router;
