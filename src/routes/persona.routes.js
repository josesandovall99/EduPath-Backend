import express from "express";
import {
  crearPersona,
  obtenerPersonas,
  obtenerPersonaPorId,
  actualizarPersona,
  eliminarPersona,
} from "../controllers/persona.controller.js";

const router = express.Router();

// CRUD Persona
router.post("/", crearPersona);        // CREATE
router.get("/", obtenerPersonas);       // READ ALL
router.get("/:id", obtenerPersonaPorId); // READ ONE
router.put("/:id", actualizarPersona);  // UPDATE
router.delete("/:id", eliminarPersona); // DELETE

export default router;
