const { Persona } = require("../models");

/* =========================
   CREAR PERSONA (BASE)
   ❗ NO crea estudiante ni admin
========================= */
const crearPersona = async (req, res) => {
  try {
    const {
      nombre,
      email,
      codigoAcceso,
      contraseña,
    } = req.body;

    // Validación básica
    if (!nombre || !email || !codigoAcceso || !contraseña) {
      return res.status(400).json({
        mensaje: "Todos los campos son obligatorios",
      });
    }

    const persona = await Persona.create({
      nombre,
      email,
      codigoAcceso,
      contraseña,
      tipoUsuario: "PERSONA",
    });

    res.status(201).json(persona);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al crear persona",
      error: error.message,
    });
  }
};

/* =========================
   OBTENER TODAS
========================= */
const obtenerPersonas = async (req, res) => {
  try {
    const personas = await Persona.findAll();
    res.json(personas);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener personas",
      error: error.message,
    });
  }
};

/* =========================
   OBTENER POR ID
========================= */
const obtenerPersonaPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const persona = await Persona.findByPk(id);
    if (!persona) {
      return res.status(404).json({
        mensaje: "Persona no encontrada",
      });
    }

    res.json(persona);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al obtener persona",
      error: error.message,
    });
  }
};

/* =========================
   ACTUALIZAR
========================= */
const actualizarPersona = async (req, res) => {
  try {
    const { id } = req.params;

    const persona = await Persona.findByPk(id);
    if (!persona) {
      return res.status(404).json({
        mensaje: "Persona no encontrada",
      });
    }

    // Campos protegidos
    delete req.body.fechaRegistro;
    delete req.body.tipoUsuario;

    await persona.update(req.body);

    res.json({
      mensaje: "Persona actualizada correctamente",
      persona,
    });
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al actualizar persona",
      error: error.message,
    });
  }
};

/* =========================
   ELIMINAR
   ❌ Protegido por integridad
========================= */
const eliminarPersona = async (req, res) => {
  return res.status(400).json({
    mensaje:
      "No se puede eliminar una persona directamente. Elimine primero su rol (estudiante o administrador).",
  });
};

/* =========================
   EXPORTS
========================= */
module.exports = {
  crearPersona,
  obtenerPersonas,
  obtenerPersonaPorId,
  actualizarPersona,
  eliminarPersona,
};
