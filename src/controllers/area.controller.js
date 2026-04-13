const { Area } = require('../models');

const canViewInactiveAreas = (req) => ['ADMINISTRADOR', 'DOCENTE'].includes(req.tipoUsuario);

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

    if (!canViewInactiveAreas(req)) {
      where.estado = true;
    }
    
    // Admin ve todas las áreas
    // Docente ve solo su área
    if (req.tipoUsuario === "DOCENTE") {
      const allowedAreaIds = Array.isArray(req.docenteAreaIds)
        ? req.docenteAreaIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
        : [];

      if (allowedAreaIds.length > 0) {
        where.id = allowedAreaIds;
      } else if (req.docenteAreaId) {
        where.id = req.docenteAreaId;
      }
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
    if (req.tipoUsuario === "DOCENTE") {
      const requestedAreaId = parseInt(req.params.id, 10);
      const allowedAreaIds = Array.isArray(req.docenteAreaIds)
        ? req.docenteAreaIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
        : [];

      const isAllowed = allowedAreaIds.length > 0
        ? allowedAreaIds.includes(requestedAreaId)
        : (req.docenteAreaId ? requestedAreaId === parseInt(req.docenteAreaId, 10) : true);

      if (!isAllowed) {
        return res.status(403).json({ message: "Acceso denegado: área fuera de tu alcance" });
      }
    }

    const where = { id: req.params.id };
    if (!canViewInactiveAreas(req)) {
      where.estado = true;
    }

    const area = await Area.findOne({ where });
    if (!area) return res.status(404).json({ message: "Área no encontrada" });
    res.json(area);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el área", error });
  }
};

// Obtener áreas permitidas para el docente autenticado
exports.getMisAreasDocente = async (req, res) => {
  try {
    const allowedAreaIds = Array.isArray(req.docenteAreaIds)
      ? req.docenteAreaIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];

    if (allowedAreaIds.length === 0) {
      return res.status(403).json({ message: "Acceso denegado: área fuera de tu alcance" });
    }

    const areas = await Area.findAll({ where: { id: allowedAreaIds, estado: true } });
    res.json(areas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener las áreas del docente", error });
  }
};

// Actualizar un área (solo ADMINISTRADOR)
exports.updateArea = async (req, res) => {
  try {
    const area = await Area.findByPk(req.params.id);
    if (!area) return res.status(404).json({ message: "Área no encontrada" });

    const payload = { ...req.body };
    delete payload.estado;

    await area.update(payload);
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

    if (area.estado === false) {
      return res.json({ message: 'Área ya estaba inhabilitada' });
    }

    await area.update({ estado: false });
    res.json({ message: "Área inhabilitada correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al inhabilitar el área", error });
  }
};

exports.toggleEstadoArea = async (req, res) => {
  try {
    const area = await Area.findByPk(req.params.id);
    if (!area) return res.status(404).json({ message: 'Área no encontrada' });

    const nuevoEstado = area.estado === false;
    await area.update({ estado: nuevoEstado });

    res.json({
      message: `Área ${nuevoEstado ? 'habilitada' : 'inhabilitada'} correctamente`,
      estado: nuevoEstado,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar el estado del área', error });
  }
};
