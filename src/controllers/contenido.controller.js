const { Contenido, Tema, Subtema } = require('../models');

// Crear un contenido con validación de tema_id y subtema_id
exports.createContenido = async (req, res) => {
  try {
    const { titulo, tipo, descripcion, url, tema_id, subtema_id } = req.body;

    // Validar que el tema exista
    const temaExistente = await Tema.findByPk(tema_id);
    if (!temaExistente) {
      return res.status(400).json({ message: "El tema especificado no existe" });
    }

    // Validar que el subtema exista
    const subtemaExistente = await Subtema.findByPk(subtema_id);
    if (!subtemaExistente) {
      return res.status(400).json({ message: "El subtema especificado no existe" });
    }

    // Crear el contenido
    const nuevoContenido = await Contenido.create({
      titulo,
      tipo,
      descripcion,
      url,
      tema_id,
      subtema_id
    });

    res.status(201).json(nuevoContenido);
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

// Actualizar un contenido con validación de tema_id y subtema_id
exports.updateContenido = async (req, res) => {
  try {
    const contenido = await Contenido.findByPk(req.params.id);
    if (!contenido) return res.status(404).json({ message: "Contenido no encontrado" });

    // Si se envía un tema_id, validar que exista
    if (req.body.tema_id) {
      const temaExistente = await Tema.findByPk(req.body.tema_id);
      if (!temaExistente) {
        return res.status(400).json({ message: "El tema especificado no existe" });
      }
    }

    // Si se envía un subtema_id, validar que exista
    if (req.body.subtema_id) {
      const subtemaExistente = await Subtema.findByPk(req.body.subtema_id);
      if (!subtemaExistente) {
        return res.status(400).json({ message: "El subtema especificado no existe" });
      }
    }

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
