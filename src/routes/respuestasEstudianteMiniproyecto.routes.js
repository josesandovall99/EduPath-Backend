const express = require("express");
const {
  crearRespuestaMiniproyecto,
  obtenerRespuestasMiniproyecto,
  obtenerRespuestaMiniproyectoPorId,
  actualizarRespuestaMiniproyecto,
  eliminarRespuestaMiniproyecto,
  verificarMiniproyectoCompletado,
} = require(
  "../controllers/respuestasEstudianteMiniproyecto.controller"
);
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');

const router = express.Router();

router.post("/", autenticacionUsuario, crearRespuestaMiniproyecto);
router.get("/verificar-completado", autenticacionUsuario, verificarMiniproyectoCompletado);
router.get("/", autenticacionUsuario, obtenerRespuestasMiniproyecto);
router.get("/:id", autenticacionUsuario, obtenerRespuestaMiniproyectoPorId);
router.put("/:id", autenticacionUsuario, actualizarRespuestaMiniproyecto);
router.delete("/:id", autenticacionUsuario, eliminarRespuestaMiniproyecto);

module.exports = router;
