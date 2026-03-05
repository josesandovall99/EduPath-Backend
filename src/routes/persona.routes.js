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
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const requiereAdmin = require('../middlewares/requiereAdmin');

const router = express.Router();

router.post("/", autenticacionUsuario, requiereAdmin, crearPersona);
router.post("/forgot-password", solicitarResetPassword);
router.post("/reset-password", resetPassword);
router.post("/cambiar-password-inicial", autenticacionUsuario, cambiarContraseñaPrimerIngreso);
router.get("/", autenticacionUsuario, requiereAdmin, obtenerPersonas);
router.get("/:id", autenticacionUsuario, requiereAdmin, obtenerPersonaPorId);
router.put("/:id", autenticacionUsuario, requiereAdmin, actualizarPersona);
router.delete("/:id", autenticacionUsuario, requiereAdmin, eliminarPersona);

module.exports = router;
