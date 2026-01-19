const express = require("express");
const {
  crearAdministrador,
  obtenerAdministradores,
  obtenerAdministradorPorId,
  actualizarAdministrador,
  eliminarAdministrador,
} = require("../controllers/administrador.controller");

const { loginAdministrador } = require("../controllers/auth.controller");

const router = express.Router();

router.post("/", crearAdministrador);
router.post("/login", loginAdministrador);
router.get("/", obtenerAdministradores);
router.get("/:id", obtenerAdministradorPorId);
router.put("/:id", actualizarAdministrador);
router.delete("/:id", eliminarAdministrador);

module.exports = router;
