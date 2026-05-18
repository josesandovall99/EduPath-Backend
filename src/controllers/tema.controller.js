const { Tema, Asignatura: AsignaturaModel } = require('../models');

const canViewInactiveTemas = (req) => ['ADMINISTRADOR', 'DOCENTE'].includes(req.tipoUsuario);

const getAllowedasignaturaIds = (req) => {
  const asignaturaIds = Array.isArray(req.docenteAsignaturaIds)
    ? req.docenteAsignaturaIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
    : [];

  if (asignaturaIds.length > 0) {
    return asignaturaIds;
  }

  if (req.docenteAsignaturaId && Number.isFinite(Number(req.docenteAsignaturaId))) {
    return [Number(req.docenteAsignaturaId)];
  }

  return [];
};

const safeErrMessage = (error) =>
  error && typeof error.message === 'string' ? error.message : 'Error interno';

// Crear un tema con validación de asignatura_id
exports.createTema = async (req, res) => {
  try {
    const { nombre, descripcion, estado, asignatura_id: rawAsignaturaId } = req.body;
    const asignatura_id = Number(rawAsignaturaId);

    if (!Number.isFinite(asignatura_id)) {
      return res.status(400).json({ message: 'asignatura_id es obligatorio y debe ser numérico' });
    }

    if (!nombre || String(nombre).trim() === '') {
      return res.status(400).json({ message: 'El nombre del tema es obligatorio' });
    }

    if (req.tipoUsuario === 'DOCENTE') {
      const allowedasignaturaIds = getAllowedasignaturaIds(req);
      if (!allowedasignaturaIds.includes(asignatura_id)) {
        return res.status(403).json({ message: 'Acceso denegado: asignatura fuera de tu alcance' });
      }
    }

    const AsignaturaExistente = await AsignaturaModel.findByPk(asignatura_id);
    if (!AsignaturaExistente) {
      return res.status(400).json({ message: 'El asignatura especificada no existe' });
    }

    if (AsignaturaExistente.estado === false) {
      return res.status(400).json({ message: 'El asignatura especificada está inactiva' });
    }

    const maxOrden = await Tema.max('orden', { where: { asignatura_id } });
    const nextOrden = maxOrden != null && Number.isFinite(Number(maxOrden)) ? Number(maxOrden) + 1 : 1;

    const nuevoTema = await Tema.create({
      nombre: String(nombre).trim(),
      descripcion: descripcion != null ? String(descripcion) : null,
      estado: estado !== undefined ? Boolean(estado) : true,
      asignatura_id,
      orden: nextOrden,
    });

    res.status(201).json(nuevoTema);
  } catch (error) {
    const name = error && error.name;
    if (name === 'SequelizeValidationError' || name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: safeErrMessage(error) });
    }
    res.status(500).json({ message: 'Error al crear el tema', detail: safeErrMessage(error) });
  }
};

// Listar todos los temas
exports.getTemas = async (req, res) => {
  try {
    const where = {};
    if (!canViewInactiveTemas(req)) {
      where.estado = true;
    }
    if (req.tipoUsuario === "DOCENTE") {
      const allowedasignaturaIds = getAllowedasignaturaIds(req);
      if (allowedasignaturaIds.length > 0) {
        where.asignatura_id = allowedasignaturaIds;
      }
    }

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
    if (req.tipoUsuario === "DOCENTE") {
      const allowedasignaturaIds = getAllowedasignaturaIds(req);
      tema = await Tema.findOne({
        where: { id: req.params.id, asignatura_id: allowedasignaturaIds }
      });
    } else {
      const where = { id: req.params.id };
      if (!canViewInactiveTemas(req)) {
        where.estado = true;
      }
      tema = await Tema.findOne({ where });
    }

    if (tema && req.tipoUsuario === 'DOCENTE' && !canViewInactiveTemas(req) && tema.estado === false) {
      tema = null;
    }

    if (!tema) return res.status(404).json({ message: "Tema no encontrado" });
    res.json(tema);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el tema", error });
  }
};

// Actualizar un tema con validación de asignatura_id
exports.updateTema = async (req, res) => {
  try {
    const tema = await Tema.findByPk(req.params.id);
    if (!tema) return res.status(404).json({ message: "Tema no encontrado" });

    if (req.tipoUsuario === "DOCENTE") {
      const allowedasignaturaIds = getAllowedasignaturaIds(req);
      if (!allowedasignaturaIds.includes(Number(tema.asignatura_id))) {
        return res.status(403).json({ message: "Acceso denegado: asignatura fuera de tu alcance" });
      }
    }

    if (req.body.asignatura_id) {
      const AsignaturaExistente = await AsignaturaModel.findByPk(req.body.asignatura_id);
      if (!AsignaturaExistente) {
        return res.status(400).json({ message: "El asignatura especificada no existe" });
      }

      if (AsignaturaExistente.estado === false) {
        return res.status(400).json({ message: 'El asignatura especificada está inactiva' });
      }

      if (req.tipoUsuario === "DOCENTE") {
        const allowedasignaturaIds = getAllowedasignaturaIds(req);
        if (!allowedasignaturaIds.includes(Number(req.body.asignatura_id))) {
          return res.status(403).json({ message: "Acceso denegado: asignatura fuera de tu alcance" });
        }
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

    if (req.tipoUsuario === "DOCENTE") {
      const allowedasignaturaIds = getAllowedasignaturaIds(req);
      if (!allowedasignaturaIds.includes(Number(tema.asignatura_id))) {
        return res.status(403).json({ message: "Acceso denegado: asignatura fuera de tu alcance" });
      }
    }

    if (tema.estado === false) {
      return res.json({ message: 'Tema ya estaba inhabilitado' });
    }

    await tema.update({ estado: false });
    res.json({ message: "Tema inhabilitado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al inhabilitar el tema", error });
  }
};

exports.toggleEstadoTema = async (req, res) => {
  try {
    const tema = await Tema.findByPk(req.params.id);
    if (!tema) return res.status(404).json({ message: 'Tema no encontrado' });

    if (req.tipoUsuario === 'DOCENTE') {
      const allowedasignaturaIds = getAllowedasignaturaIds(req);
      if (!allowedasignaturaIds.includes(Number(tema.asignatura_id))) {
        return res.status(403).json({ message: 'Acceso denegado: asignatura fuera de tu alcance' });
      }
    }

    const nuevoEstado = tema.estado === false;
    await tema.update({ estado: nuevoEstado });

    res.json({
      message: `Tema ${nuevoEstado ? 'habilitado' : 'inhabilitado'} correctamente`,
      estado: nuevoEstado,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar el estado del tema', error });
  }
};

// Obtener todos los temas por asignatura
exports.getTemasByAsignatura = async (req, res) => {
  try {
    const { asignaturaId } = req.params;
    const asignaturaIdNumerico = parseInt(asignaturaId, 10);

    // Docente solo puede ver temas de su asignatura
    if (req.tipoUsuario === "DOCENTE") {
      const allowedasignaturaIds = getAllowedasignaturaIds(req);
      if (!allowedasignaturaIds.includes(asignaturaIdNumerico)) {
        return res.status(403).json({ message: "Acceso denegado: asignatura fuera de tu alcance" });
      }
    }

    const AsignaturaExistente = await AsignaturaModel.findByPk(asignaturaIdNumerico);
    if (!AsignaturaExistente) {
      return res.status(404).json({ message: "Asignatura no encontrada" });
    }

    const temas = await Tema.findAll({ where: { asignatura_id: asignaturaIdNumerico, estado: true } });
    res.json(temas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los temas del asignatura", error });
  }
};

// Reordenar temas
exports.reordenarTemas = async (req, res) => {
  try {
    const { orden } = req.body; // Array de IDs en el nuevo orden [1, 3, 2, 5, 4]

    if (!Array.isArray(orden) || orden.length === 0) {
      return res.status(400).json({ message: "Debe proporcionar un array de IDs válido" });
    }

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
