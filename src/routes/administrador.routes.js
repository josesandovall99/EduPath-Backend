import express from "express";
import {
  crearAdministrador,
  obtenerAdministradores,
  obtenerAdministradorPorId,
  actualizarAdministrador,
  eliminarAdministrador,
} from "../controllers/administrador.controller.js";

const router = express.Router();

router.post("/", crearAdministrador);
router.get("/", obtenerAdministradores);
router.get("/:id", obtenerAdministradorPorId);
router.put("/:id", actualizarAdministrador);
router.delete("/:id", eliminarAdministrador);

export default router;
