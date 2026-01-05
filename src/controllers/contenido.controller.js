const { Contenido, Tema, Subtema, Area , Estudiante } = require('../models');

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

// Obtener contenidos por subtema_id
exports.getContenidosPorSubtema = async (req, res) => {
  try {
    const { subtemaId } = req.params;

    // Validar que el subtema exista
    const subtema = await Subtema.findByPk(subtemaId);
    if (!subtema) {
      return res.status(404).json({ message: "Subtema no encontrado" });
    }

    // Buscar contenidos asociados al subtema
    const contenidos = await Contenido.findAll({
      where: { subtema_id: subtemaId }
    });

    res.json(contenidos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los contenidos por subtema", error });
  }
};

// Obtener contenidos por categoría (tipo)
exports.getContenidosPorCategoria = async (req, res) => {
  try {
    const { categoria } = req.params;

    const contenidos = await Contenido.findAll({
      where: { tipo: categoria }
    });

    if (contenidos.length === 0) {
      return res.status(404).json({ message: "No se encontraron contenidos para esta categoría" });
    }

    res.json(contenidos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los contenidos por categoría", error });
  }
};

// Obtener contenidos por nombre del área (ej. "ATC", "Fundamentos de programación")
exports.getContenidosPorAreaNombre = async (req, res) => {
  try {
    const { nombreArea } = req.params;

    // Buscar el área por nombre
    const area = await Area.findOne({ where: { nombre: nombreArea } });
    if (!area) {
      return res.status(404).json({ message: "Área no encontrada" });
    }

    // Buscar temas de esa área
    const temas = await Tema.findAll({ where: { area_id: area.id } });
    const temaIds = temas.map(t => t.id);

    // Buscar contenidos relacionados a esos temas
    const contenidos = await Contenido.findAll({
      where: { tema_id: temaIds },
      include: [
        { model: Tema },
        { model: Subtema }
      ]
    });

    res.json(contenidos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener contenidos por área", error });
  }
};

// Obtener contenidos adaptados al perfil del estudiante según su semestre
exports.adaptarContenidoPorPerfil = async (req, res) => {
  try {
    const { estudianteId } = req.params;

    // Buscar al estudiante
    const estudiante = await Estudiante.findByPk(estudianteId);
    if (!estudiante) {
      return res.status(404).json({ message: "Estudiante no encontrado" });
    }

    const semestre = estudiante.semestre;

    // Determinar áreas permitidas según el semestre
    let nombresAreas = [];

    if (semestre >= 1 && semestre <= 4) {
      nombresAreas = ["Fundamentos de programación"];
    } else if (semestre >= 5 && semestre <= 6) {
      nombresAreas = ["Fundamentos de programación", "Análisis de sistemas"];
    } else if (semestre >= 7 && semestre <= 10) {
      nombresAreas = ["Fundamentos de programación", "Análisis de sistemas", "ATC"];
    } else {
      return res.status(400).json({ message: "Semestre fuera de rango válido (1-10)" });
    }

    // Buscar las áreas por nombre
    const areas = await Area.findAll({
      where: { nombre: nombresAreas }
    });

    const areaIds = areas.map(area => area.id);

    // Buscar los temas de esas áreas
    const temas = await Tema.findAll({
      where: { area_id: areaIds }
    });

    const temaIds = temas.map(tema => tema.id);

    // Buscar los contenidos relacionados a esos temas
    const contenidos = await Contenido.findAll({
      where: { tema_id: temaIds },
      include: [
        { model: Tema },
        { model: Subtema }
      ]
    });

    res.json({
      estudianteId,
      semestre,
      areas: nombresAreas,
      totalContenidos: contenidos.length,
      contenidos
    });

  } catch (error) {
    res.status(500).json({
      message: "Error al adaptar los contenidos por perfil del estudiante",
      error: error.message || error
    });
  }
};

