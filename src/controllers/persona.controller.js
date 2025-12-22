const Persona = require("../models/persona.model");

/* CREAR PERSONA */
const crearPersona = async (req, res) => {
  try {
    const {
      nombre,
      email,
      codigo_acceso,
      contraseña,
      tipo_usuario,
    } = req.body;

    const persona = await Persona.create({
      nombre,
      email,
      codigo_acceso,
      contraseña,
      tipo_usuario,
    });

    res.status(201).json(persona);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error al crear persona",
      error: error.message,
    });
  }
};

/* OBTENER TODAS */
const obtenerPersonas = async (req, res) => {
  try {
    const personas = await Persona.findAll();
    res.json(personas);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener personas" });
  }
};

/* OBTENER POR ID */
const obtenerPersonaPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const persona = await Persona.findByPk(id);
    if (!persona) {
      return res.status(404).json({ mensaje: "Persona no encontrada" });
    }

    res.json(persona);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener persona" });
  }
};

/* ACTUALIZAR */
const actualizarPersona = async (req, res) => {
  try {
    const { id } = req.params;

    delete req.body.fecha_registro;

    const persona = await Persona.findByPk(id);
    if (!persona) {
      return res.status(404).json({ mensaje: "Persona no encontrada" });
    }

    await persona.update(req.body);
    res.json(persona);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al actualizar persona" });
  }
};

/* ELIMINAR */
const eliminarPersona = async (req, res) => {
  try {
    const { id } = req.params;

    const persona = await Persona.findByPk(id);
    if (!persona) {
      return res.status(404).json({ mensaje: "Persona no encontrada" });
    }

    await persona.destroy();
    res.json({ mensaje: "Persona eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar persona" });
  }
};

module.exports = {
  crearPersona,
  obtenerPersonas,
  obtenerPersonaPorId,
  actualizarPersona,
  eliminarPersona,
};
