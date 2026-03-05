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
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const requiereAdmin = require('../middlewares/requiereAdmin');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage()
});

// === RUTAS ===

// 🔐 Login (Usando el controlador separado)
router.post("/login", loginEstudiante);
router.post("/cambiar-password-inicial", autenticacionUsuario, cambiarContraseñaPrimerIngreso);

// CRUD Estudiantes
router.post("/", autenticacionUsuario, requiereAdmin, crearEstudiante);
router.get("/", autenticacionUsuario, requiereAdmin, obtenerEstudiantes);
router.get("/:id", autenticacionUsuario, requiereAdmin, obtenerEstudiantePorId);
router.put("/:id", autenticacionUsuario, requiereAdmin, actualizarEstudiante);
router.delete("/:id", autenticacionUsuario, requiereAdmin, eliminarEstudiante);

// Importar Excel
router.post(
  "/importar-excel",
  autenticacionUsuario,
  requiereAdmin,
  upload.single("archivo"),
  importarEstudiantesDesdeExcel
);

module.exports = router;
