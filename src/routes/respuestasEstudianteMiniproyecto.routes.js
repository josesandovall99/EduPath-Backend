import express from "express";
import {
  crearRespuestaMiniproyecto,
  obtenerRespuestasMiniproyecto,
  obtenerRespuestaMiniproyectoPorId,
  actualizarRespuestaMiniproyecto,
  eliminarRespuestaMiniproyecto,
} from "../controllers/respuestaEstudianteMiniproyecto.controller.js";

const router = express.Router();

router.post("/", crearRespuestaMiniproyecto);
router.get("/", obtenerRespuestasMiniproyecto);
router.get("/:id", obtenerRespuestaMiniproyectoPorId);
router.put("/:id", actualizarRespuestaMiniproyecto);
router.delete("/:id", eliminarRespuestaMiniproyecto);

export default router;
