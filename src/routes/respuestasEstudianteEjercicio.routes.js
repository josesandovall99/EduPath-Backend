import express from "express";
import {
  crearRespuesta,
  obtenerRespuestas,
  obtenerRespuestaPorId,
  actualizarRespuesta,
  eliminarRespuesta,
} from "../controllers/respuestaEstudianteEjercicio.controller.js";

const router = express.Router();

router.post("/", crearRespuesta);
router.get("/", obtenerRespuestas);
router.get("/:id", obtenerRespuestaPorId);
router.put("/:id", actualizarRespuesta);
router.delete("/:id", eliminarRespuesta);

export default router;