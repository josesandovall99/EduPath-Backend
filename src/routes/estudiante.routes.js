const express = require("express");
const multer = require("multer"); 

// Importamos el controlador original de estudiantes
const {
  crearEstudiante,
  obtenerEstudiantes,
  obtenerEstudiantePorId,
  actualizarEstudiante,
  eliminarEstudiante,
  importarEstudiantesDesdeExcel,
} = require("../controllers/estudiante.controller");

// 🔥 Importamos el NUEVO controlador de Auth
const { loginEstudiante, cambiarContraseñaPrimerIngreso } = require("../controllers/auth.controller");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage()
});

// === RUTAS ===

// 🔐 Login (Usando el controlador separado)
router.post("/login", loginEstudiante);
router.post("/cambiar-password-inicial", cambiarContraseñaPrimerIngreso);

// CRUD Estudiantes
router.post("/", crearEstudiante);
router.get("/", obtenerEstudiantes);
router.get("/:id", obtenerEstudiantePorId);
router.put("/:id", actualizarEstudiante);
router.delete("/:id", eliminarEstudiante);

// Importar Excel
router.post(
  "/importar-excel",
  upload.single("archivo"),
  importarEstudiantesDesdeExcel
);

module.exports = router;
