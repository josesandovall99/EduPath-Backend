const { Contenido } = require('../models');

// Crear un contenido
exports.createContenido = async (req, res) => {
  try {
    const contenido = await Contenido.create(req.body);
    res.status(201).json(contenido);
  } catch (error) {
    res.status(500).json({ message: "Error al crear el contenido", error });
  }
};

// Listar todos los contenidos
exports.getContenidos = async (req, res) => {
  try {
    const contenidos = await Contenido.findAll();
    res.json(contenidos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los contenidos", error });
  }
};

// Obtener un contenido por ID
exports.getContenidoById = async (req, res) => {
  try {
    const contenido = await Contenido.findByPk(req.params.id);
    if (!contenido) return res.status(404).json({ message: "Contenido no encontrado" });
    res.json(contenido);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el contenido", error });
  }
};

// Actualizar un contenido
exports.updateContenido = async (req, res) => {
  try {
    const contenido = await Contenido.findByPk(req.params.id);
    if (!contenido) return res.status(404).json({ message: "Contenido no encontrado" });

    await contenido.update(req.body);
    res.json(contenido);
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el contenido", error });
  }
};

// Eliminar un contenido
exports.deleteContenido = async (req, res) => {
  try {
    const contenido = await Contenido.findByPk(req.params.id);
    if (!contenido) return res.status(404).json({ message: "Contenido no encontrado" });

    await contenido.destroy();
    res.json({ message: "Contenido eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el contenido", error });
  }
};
