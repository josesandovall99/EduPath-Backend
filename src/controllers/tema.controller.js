const { Tema, Area } = require('../models');

// Crear un tema con validación de area_id
exports.createTema = async (req, res) => {
  try {
    const { nombre, descripcion, estado, area_id } = req.body;

    // Validar que el área exista
    const areaExistente = await Area.findByPk(area_id);
    if (!areaExistente) {
      return res.status(400).json({ message: "El área especificada no existe" });
    }

    // Crear el tema
    const nuevoTema = await Tema.create({
      nombre,
      descripcion,
      estado,
      area_id
    });

    res.status(201).json(nuevoTema);
  } catch (error) {
    res.status(500).json({ message: "Error al crear el tema", error });
  }
};

// Listar todos los temas
exports.getTemas = async (req, res) => {
  try {
    const where = {};
    // Solo docentes están limitados a su área
    if (req.tipoUsuario === "DOCENTE" && req.docenteAreaId) {
      where.area_id = req.docenteAreaId;
    }
    // Admin y otros usuarios ven todos

    const temas = await Tema.findAll({ where });
    res.json(temas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los temas", error });
  }
};

// Obtener un tema por ID
exports.getTemaById = async (req, res) => {
  try {
    let tema = null;
    // Solo docentes están limitados a su área
    if (req.tipoUsuario === "DOCENTE" && req.docenteAreaId) {
      tema = await Tema.findOne({
        where: { id: req.params.id, area_id: req.docenteAreaId }
      });
    } else {
      // Admin y otros usuarios ven cualquier tema
      tema = await Tema.findByPk(req.params.id);
    }

    if (!tema) return res.status(404).json({ message: "Tema no encontrado" });
    res.json(tema);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el tema", error });
  }
};

// Actualizar un tema con validación de area_id
exports.updateTema = async (req, res) => {
  try {
    const tema = await Tema.findByPk(req.params.id);
    if (!tema) return res.status(404).json({ message: "Tema no encontrado" });

    // Si se envía un area_id, validar que exista
    if (req.body.area_id) {
      const areaExistente = await Area.findByPk(req.body.area_id);
      if (!areaExistente) {
        return res.status(400).json({ message: "El área especificada no existe" });
      }
    }

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

// Obtener todos los temas por área
exports.getTemasByArea = async (req, res) => {
  try {
    const { areaId } = req.params;

    // Docente solo puede ver temas de su área
    if (req.tipoUsuario === "DOCENTE" && req.docenteAreaId && parseInt(areaId, 10) !== parseInt(req.docenteAreaId, 10)) {
      return res.status(403).json({ message: "Acceso denegado: área fuera de tu alcance" });
    }

    // Validar que el área exista
    const areaExistente = await Area.findByPk(areaId);
    if (!areaExistente) {
      return res.status(404).json({ message: "Área no encontrada" });
    }

    const temas = await Tema.findAll({ where: { area_id: areaId, estado: true } });
    res.json(temas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los temas del área", error });
  }
};

// Reordenar temas
exports.reordenarTemas = async (req, res) => {
  try {
    const { orden } = req.body; // Array de IDs en el nuevo orden [1, 3, 2, 5, 4]

    if (!Array.isArray(orden) || orden.length === 0) {
      return res.status(400).json({ message: "Debe proporcionar un array de IDs válido" });
    }

    // Actualizar el orden de cada tema
    const promesas = orden.map((id, index) => {
      return Tema.update(
        { orden: index + 1 },
        { where: { id } }
      );
    });

    await Promise.all(promesas);

    res.json({ message: "Temas reordenados correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al reordenar los temas", error });
  }
};
