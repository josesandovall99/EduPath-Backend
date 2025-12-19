const { Subtema } = require('../models');

// Crear un subtema
exports.createSubtema = async (req, res) => {
  try {
    const subtema = await Subtema.create(req.body);
    res.status(201).json(subtema);
  } catch (error) {
    res.status(500).json({ message: "Error al crear el subtema", error });
  }
};

// Listar todos los subtemas
exports.getSubtemas = async (req, res) => {
  try {
    const subtemas = await Subtema.findAll();
    res.json(subtemas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los subtemas", error });
  }
};

// Obtener un subtema por ID
exports.getSubtemaById = async (req, res) => {
  try {
    const subtema = await Subtema.findByPk(req.params.id);
    if (!subtema) return res.status(404).json({ message: "Subtema no encontrado" });
    res.json(subtema);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el subtema", error });
  }
};

// Actualizar un subtema
exports.updateSubtema = async (req, res) => {
  try {
    const subtema = await Subtema.findByPk(req.params.id);
    if (!subtema) return res.status(404).json({ message: "Subtema no encontrado" });

    await subtema.update(req.body);
    res.json(subtema);
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el subtema", error });
  }
};

// Eliminar un subtema
exports.deleteSubtema = async (req, res) => {
  try {
    const subtema = await Subtema.findByPk(req.params.id);
    if (!subtema) return res.status(404).json({ message: "Subtema no encontrado" });

    await subtema.destroy();
    res.json({ message: "Subtema eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el subtema", error });
  }
};
