const { Tema } = require('../models');

// Crear un tema
exports.createTema = async (req, res) => {
  try {
    const tema = await Tema.create(req.body);
    res.status(201).json(tema);
  } catch (error) {
    res.status(500).json({ message: "Error al crear el tema", error });
  }
};

// Listar todos los temas
exports.getTemas = async (req, res) => {
  try {
    const temas = await Tema.findAll();
    res.json(temas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los temas", error });
  }
};

// Obtener un tema por ID
exports.getTemaById = async (req, res) => {
  try {
    const tema = await Tema.findByPk(req.params.id);
    if (!tema) return res.status(404).json({ message: "Tema no encontrado" });
    res.json(tema);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el tema", error });
  }
};

// Actualizar un tema
exports.updateTema = async (req, res) => {
  try {
    const tema = await Tema.findByPk(req.params.id);
    if (!tema) return res.status(404).json({ message: "Tema no encontrado" });

    await tema.update(req.body);
    res.json(tema);
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el tema", error });
  }
};

// Eliminar un tema
exports.deleteTema = async (req, res) => {
  try {
    const tema = await Tema.findByPk(req.params.id);
    if (!tema) return res.status(404).json({ message: "Tema no encontrado" });

    await tema.destroy();
    res.json({ message: "Tema eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el tema", error });
  }
};
