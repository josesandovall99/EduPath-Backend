const express = require("express");
const {
  crearAdministrador,
  obtenerAdministradores,
  obtenerAdministradorPorId,
  actualizarAdministrador,
  eliminarAdministrador,
} = require("../controllers/administrador.controller");
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const requiereAdmin = require('../middlewares/requiereAdmin');

const { loginAdministrador } = require("../controllers/auth.controller");

const router = express.Router();

router.post("/", autenticacionUsuario, requiereAdmin, crearAdministrador);
router.post("/login", loginAdministrador);
router.get("/", autenticacionUsuario, requiereAdmin, obtenerAdministradores);
router.get("/:id", autenticacionUsuario, requiereAdmin, obtenerAdministradorPorId);
router.put("/:id", autenticacionUsuario, requiereAdmin, actualizarAdministrador);
router.delete("/:id", autenticacionUsuario, requiereAdmin, eliminarAdministrador);

module.exports = router;
