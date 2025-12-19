import Persona from "../models/persona.model.js";

export const crearPersona = async (req, res) => {
  try {
    const { nombre, email, codigoAcceso, contraseña, tipoUsuario,  fechaRegistro} = req.body;

    if (!nombre || !email || !codigoAcceso || !contraseña || !tipoUsuario || !fechaRegistro) {
      return res.status(400).json({
        mensaje: "Todos los campos son obligatorios",
      });
    }

    const persona = await Persona.create({
      nombre,
      email,
      codigoAcceso,
      contraseña,
      tipoUsuario,
      fechaRegistro,
    });

    res.status(201).json(persona);
  } catch (error) {
    console.error("Error al crear persona:", error);
    res.status(500).json({
      mensaje: "Error al crear la persona",
    });
  }
};

export const obtenerPersonas = async (req, res) => {
  try {
    const personas = await Persona.findAll();
    res.json(personas);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener personas" });
  }
};

export const obtenerPersonaPorId = async (req, res) => {
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

export const actualizarPersona = async (req, res) => {
  try {
    const { id } = req.params;

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

export const eliminarPersona = async (req, res) => {
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
