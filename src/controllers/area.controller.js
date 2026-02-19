const { Area } = require('../models');

// Crear un área (solo ADMINISTRADOR)
exports.createArea = async (req, res) => {
  try {
    const area = await Area.create(req.body);
    res.status(201).json(area);
  } catch (error) {
    res.status(500).json({ message: "Error al crear el área", error });
  }
};

// Listar todas las áreas
exports.getAreas = async (req, res) => {
  try {
    const where = {};
    
    // Admin ve todas las áreas
    // Docente ve solo su área
    if (req.tipoUsuario === "DOCENTE" && req.docenteAreaId) {
      where.id = req.docenteAreaId;
    }
    // Administrador no tiene restricción
    // Otros tipos de usuario (estudiante) tampoco tienen restricción en GET

    const areas = await Area.findAll({ where });
    res.json(areas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener las áreas", error });
  }
};

// Obtener un área por ID
exports.getAreaById = async (req, res) => {
  try {
    // Docente solo puede ver su propia área
    if (req.tipoUsuario === "DOCENTE" && req.docenteAreaId && parseInt(req.params.id, 10) !== parseInt(req.docenteAreaId, 10)) {
      return res.status(403).json({ message: "Acceso denegado: área fuera de tu alcance" });
    }

    const area = await Area.findByPk(req.params.id);
    if (!area) return res.status(404).json({ message: "Área no encontrada" });
    res.json(area);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el área", error });
  }
};

// Actualizar un área (solo ADMINISTRADOR)
exports.updateArea = async (req, res) => {
  try {
    const area = await Area.findByPk(req.params.id);
    if (!area) return res.status(404).json({ message: "Área no encontrada" });

    await area.update(req.body);
    res.json(area);
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el área", error });
  }
};

// Eliminar un área (solo ADMINISTRADOR)
exports.deleteArea = async (req, res) => {
  try {
    const area = await Area.findByPk(req.params.id);
    if (!area) return res.status(404).json({ message: "Área no encontrada" });

    await area.destroy();
    res.json({ message: "Área eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el área", error });
  }
};
