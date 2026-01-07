const { Subtema, Tema } = require('../models');

// Crear un subtema con validación de tema_id
exports.createSubtema = async (req, res) => {
  try {
    const { nombre, descripcion, tema_id } = req.body;

    // Validar que el tema exista
    const temaExistente = await Tema.findByPk(tema_id);
    if (!temaExistente) {
      return res.status(400).json({ message: "El tema especificado no existe" });
    }

    // Crear el subtema
    const nuevoSubtema = await Subtema.create({
      nombre,
      descripcion,
      tema_id
    });

    res.status(201).json(nuevoSubtema);
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

// Actualizar un subtema con validación de tema_id
exports.updateSubtema = async (req, res) => {
  try {
    const subtema = await Subtema.findByPk(req.params.id);
    if (!subtema) return res.status(404).json({ message: "Subtema no encontrado" });

    // Si se envía un tema_id, validar que exista
    if (req.body.tema_id) {
      const temaExistente = await Tema.findByPk(req.body.tema_id);
      if (!temaExistente) {
        return res.status(400).json({ message: "El tema especificado no existe" });
      }
    }

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

// Obtener todos los subtemas por tema
exports.getSubtemasByTema = async (req, res) => {
  try {
    const { temaId } = req.params;

    // Validar que el tema exista
    const temaExistente = await Tema.findByPk(temaId);
    if (!temaExistente) {
      return res.status(404).json({ message: "Tema no encontrado" });
    }

    const subtemas = await Subtema.findAll({ where: { tema_id: temaId } });
    res.json(subtemas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los subtemas del tema", error });
  }
};
