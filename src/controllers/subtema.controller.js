const { Subtema, Tema } = require('../models');

const canViewInactiveSubtemas = (req) => ['ADMINISTRADOR', 'DOCENTE'].includes(req.tipoUsuario);

exports.createSubtema = async (req, res) => {
  try {
    const { nombre, descripcion, tema_id } = req.body;

    const temaExistente = await Tema.findByPk(tema_id);
    if (!temaExistente) {
      return res.status(400).json({ message: "El tema especificado no existe" });
    }

    if (temaExistente.estado === false) {
      return res.status(400).json({ message: 'El tema especificado está inactivo' });
    }

    if (req.docenteAsignaturaId && parseInt(temaExistente.asignatura_id, 10) !== parseInt(req.docenteAsignaturaId, 10)) {
      return res.status(403).json({ message: "Acceso denegado: asignatura fuera de tu alcance" });
    }

    const nuevoSubtema = await Subtema.create({ nombre, descripcion, tema_id });
    res.status(201).json(nuevoSubtema);
  } catch (error) {
    res.status(500).json({ message: "Error al crear el subtema", error });
  }
};

exports.getSubtemas = async (req, res) => {
  try {
    const where = {};
    if (!canViewInactiveSubtemas(req)) {
      where.estado = true;
    }

    if (req.docenteAsignaturaId) {
      const temas = await Tema.findAll({
        where: { asignatura_id: req.docenteAsignaturaId },
        attributes: ['id']
      });

      const temaIds = temas.map((tema) => tema.id);
      if (temaIds.length === 0) {
        return res.json([]);
      }

      where.tema_id = temaIds;
    }

    const subtemas = await Subtema.findAll({ where });
    res.json(subtemas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los subtemas", error });
  }
};

exports.getSubtemaById = async (req, res) => {
  try {
    let subtema = null;
    if (req.docenteAsignaturaId) {
      const temas = await Tema.findAll({
        where: { asignatura_id: req.docenteAsignaturaId },
        attributes: ['id']
      });

      const temaIds = temas.map((tema) => tema.id);
      if (temaIds.length === 0) {
        return res.status(404).json({ message: "Subtema no encontrado" });
      }

      subtema = await Subtema.findOne({
        where: {
          id: req.params.id,
          tema_id: temaIds,
          ...(!canViewInactiveSubtemas(req) ? { estado: true } : {}),
        }
      });
    } else {
      const where = { id: req.params.id };
      if (!canViewInactiveSubtemas(req)) {
        where.estado = true;
      }
      subtema = await Subtema.findOne({ where });
    }

    if (!subtema) return res.status(404).json({ message: "Subtema no encontrado" });
    res.json(subtema);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el subtema", error });
  }
};

exports.updateSubtema = async (req, res) => {
  try {
    const subtema = await Subtema.findByPk(req.params.id);
    if (!subtema) return res.status(404).json({ message: "Subtema no encontrado" });

    if (req.docenteAsignaturaId) {
      const temaActual = await Tema.findByPk(subtema.tema_id);
      if (!temaActual || parseInt(temaActual.asignatura_id, 10) !== parseInt(req.docenteAsignaturaId, 10)) {
        return res.status(403).json({ message: "Acceso denegado: asignatura fuera de tu alcance" });
      }
    }

    if (req.body.tema_id) {
      const temaExistente = await Tema.findByPk(req.body.tema_id);
      if (!temaExistente) {
        return res.status(400).json({ message: "El tema especificado no existe" });
      }

      if (temaExistente.estado === false) {
        return res.status(400).json({ message: 'El tema especificado está inactivo' });
      }

      if (req.docenteAsignaturaId && parseInt(temaExistente.asignatura_id, 10) !== parseInt(req.docenteAsignaturaId, 10)) {
        return res.status(403).json({ message: "Acceso denegado: asignatura fuera de tu alcance" });
      }
    }

    await subtema.update(req.body);
    res.json(subtema);
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el subtema", error });
  }
};

exports.deleteSubtema = async (req, res) => {
  try {
    const subtema = await Subtema.findByPk(req.params.id);
    if (!subtema) return res.status(404).json({ message: "Subtema no encontrado" });

    if (req.docenteAsignaturaId) {
      const temaActual = await Tema.findByPk(subtema.tema_id);
      if (!temaActual || parseInt(temaActual.asignatura_id, 10) !== parseInt(req.docenteAsignaturaId, 10)) {
        return res.status(403).json({ message: "Acceso denegado: asignatura fuera de tu alcance" });
      }
    }

    if (subtema.estado === false) {
      return res.json({ message: 'Subtema ya estaba inhabilitado' });
    }

    await subtema.update({ estado: false });
    res.json({ message: "Subtema inhabilitado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al inhabilitar el subtema", error });
  }
};

exports.toggleEstadoSubtema = async (req, res) => {
  try {
    const subtema = await Subtema.findByPk(req.params.id);
    if (!subtema) return res.status(404).json({ message: 'Subtema no encontrado' });

    if (req.docenteAsignaturaId) {
      const temaActual = await Tema.findByPk(subtema.tema_id);
      if (!temaActual || parseInt(temaActual.asignatura_id, 10) !== parseInt(req.docenteAsignaturaId, 10)) {
        return res.status(403).json({ message: 'Acceso denegado: asignatura fuera de tu alcance' });
      }
    }

    const nuevoEstado = subtema.estado === false;
    await subtema.update({ estado: nuevoEstado });

    res.json({
      message: `Subtema ${nuevoEstado ? 'habilitado' : 'inhabilitado'} correctamente`,
      estado: nuevoEstado,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar el estado del subtema', error });
  }
};

exports.getSubtemasByTema = async (req, res) => {
  try {
    const { temaId } = req.params;

    const temaWhere = { id: temaId };
    if (req.docenteAsignaturaId) {
      temaWhere.asignatura_id = req.docenteAsignaturaId;
    }

    const temaExistente = await Tema.findOne({ where: temaWhere });
    if (!temaExistente) {
      return res.status(404).json({ message: "Tema no encontrado" });
    }

    const subtemas = await Subtema.findAll({ where: { tema_id: temaId, estado: true } });
    res.json(subtemas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los subtemas del tema", error });
  }
};
