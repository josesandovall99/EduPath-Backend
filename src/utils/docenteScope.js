const { Op } = require('sequelize');
const {
  Tema,
  Subtema,
  Contenido,
  SecuenciaSubtema,
  SecuenciaContenido
} = require('../models');

const toAllowedasignaturaIds = (req) => (
  Array.isArray(req.docenteAsignaturaIds)
    ? req.docenteAsignaturaIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
    : []
);

const isAdmin = (req) => req.tipoUsuario === 'ADMINISTRADOR';
const isDocente = (req) => req.tipoUsuario === 'DOCENTE';

const buildScopedError = (status, message, extra = {}) => {
  const error = new Error(message);
  error.status = status;
  error.payload = { message, ...extra };
  return error;
};

const ensureDocenteAsignaturaAccess = (req, asignaturaId) => {
  if (isAdmin(req)) {
    return;
  }

  if (!isDocente(req)) {
    throw buildScopedError(403, 'Acceso denegado: se requiere ser administrador o docente');
  }

  const allowedasignaturaIds = toAllowedasignaturaIds(req);
  if (allowedasignaturaIds.length === 0) {
    throw buildScopedError(401, 'No autorizado: asignaturas del docente no disponibles');
  }

  const normalizedAsignaturaId = Number(asignaturaId);
  if (!Number.isFinite(normalizedAsignaturaId) || !allowedasignaturaIds.includes(normalizedAsignaturaId)) {
    throw buildScopedError(403, 'Acceso denegado: asignatura fuera de tu alcance', {
      AsignaturaIntentada: Number.isFinite(normalizedAsignaturaId) ? normalizedAsignaturaId : asignaturaId,
      asignaturasPermitidas: allowedasignaturaIds
    });
  }
};

const resolveTemaAsignatura = async (temaId) => {
  const tema = await Tema.findByPk(temaId, { attributes: ['id', 'asignatura_id', 'estado'] });
  if (!tema) {
    throw buildScopedError(404, 'Tema no encontrado');
  }

  return {
    temaId: Number(tema.id),
    asignaturaId: Number(tema.asignatura_id),
    estado: tema.estado !== false
  };
};

const resolveSubtemaAsignatura = async (subtemaId) => {
  const subtema = await Subtema.findByPk(subtemaId, { attributes: ['id', 'tema_id', 'estado'] });
  if (!subtema) {
    throw buildScopedError(404, 'Subtema no encontrado');
  }

  const temaContext = await resolveTemaAsignatura(subtema.tema_id);

  return {
    subtemaId: Number(subtema.id),
    temaId: temaContext.temaId,
    asignaturaId: temaContext.asignaturaId,
    estado: subtema.estado !== false
  };
};

const resolveContenidoAsignatura = async (contenidoId) => {
  const contenido = await Contenido.findByPk(contenidoId, {
    attributes: ['id', 'tema_id', 'subtema_id', 'estado']
  });

  if (!contenido) {
    throw buildScopedError(404, 'Contenido no encontrado');
  }

  if (Number.isFinite(Number(contenido.tema_id))) {
    const temaContext = await resolveTemaAsignatura(contenido.tema_id);
    return {
      contenidoId: Number(contenido.id),
      subtemaId: Number(contenido.subtema_id),
      temaId: temaContext.temaId,
      asignaturaId: temaContext.asignaturaId,
      estado: contenido.estado !== false
    };
  }

  if (Number.isFinite(Number(contenido.subtema_id))) {
    const subtemaContext = await resolveSubtemaAsignatura(contenido.subtema_id);
    return {
      contenidoId: Number(contenido.id),
      subtemaId: subtemaContext.subtemaId,
      temaId: subtemaContext.temaId,
      asignaturaId: subtemaContext.asignaturaId,
      estado: contenido.estado !== false
    };
  }

  throw buildScopedError(400, 'El contenido no tiene una relación válida con un asignatura');
};

const resolveSecuenciaSubtemaAsignatura = async (sequenceId) => {
  const secuencia = await SecuenciaSubtema.findByPk(sequenceId, {
    attributes: ['id', 'subtema_origen_id', 'subtema_destino_id', 'estado']
  });

  if (!secuencia) {
    throw buildScopedError(404, 'Secuencia de subtema no encontrada');
  }

  const context = await resolveSubtemaAsignatura(secuencia.subtema_origen_id);
  return { secuencia, ...context };
};

const resolveSecuenciaContenidoAsignatura = async (sequenceId) => {
  const secuencia = await SecuenciaContenido.findByPk(sequenceId, {
    attributes: ['id', 'contenido_origen_id', 'contenido_destino_id', 'estado']
  });

  if (!secuencia) {
    throw buildScopedError(404, 'Secuencia de contenido no encontrada');
  }

  const context = await resolveContenidoAsignatura(secuencia.contenido_origen_id);
  return { secuencia, ...context };
};

const buildDocenteSubtemaSequenceWhere = async (req) => {
  if (!isDocente(req)) {
    return {};
  }

  const allowedasignaturaIds = toAllowedasignaturaIds(req);
  if (allowedasignaturaIds.length === 0) {
    throw buildScopedError(401, 'No autorizado: asignaturas del docente no disponibles');
  }

  const temas = await Tema.findAll({
    where: { asignatura_id: { [Op.in]: allowedasignaturaIds } },
    attributes: ['id']
  });
  const temaIds = temas.map((tema) => Number(tema.id));

  const subtemas = temaIds.length > 0
    ? await Subtema.findAll({
        where: { tema_id: { [Op.in]: temaIds } },
        attributes: ['id']
      })
    : [];
  const subtemaIds = subtemas.map((subtema) => Number(subtema.id));

  return {
    subtema_origen_id: { [Op.in]: subtemaIds.length > 0 ? subtemaIds : [0] },
    subtema_destino_id: { [Op.in]: subtemaIds.length > 0 ? subtemaIds : [0] }
  };
};

const buildDocenteContenidoSequenceWhere = async (req) => {
  if (!isDocente(req)) {
    return {};
  }

  const allowedasignaturaIds = toAllowedasignaturaIds(req);
  if (allowedasignaturaIds.length === 0) {
    throw buildScopedError(401, 'No autorizado: asignaturas del docente no disponibles');
  }

  const temas = await Tema.findAll({
    where: { asignatura_id: { [Op.in]: allowedasignaturaIds } },
    attributes: ['id']
  });
  const temaIds = temas.map((tema) => Number(tema.id));

  const contenidos = temaIds.length > 0
    ? await Contenido.findAll({
        where: { tema_id: { [Op.in]: temaIds } },
        attributes: ['id']
      })
    : [];
  const contenidoIds = contenidos.map((contenido) => Number(contenido.id));

  return {
    contenido_origen_id: { [Op.in]: contenidoIds.length > 0 ? contenidoIds : [0] },
    contenido_destino_id: { [Op.in]: contenidoIds.length > 0 ? contenidoIds : [0] }
  };
};

const handleDocenteScopeError = (res, error, fallbackMessage) => {
  if (error?.status) {
    return res.status(error.status).json(error.payload || { message: error.message });
  }

  return res.status(500).json({
    message: fallbackMessage,
    error: error.message
  });
};

/**
 * Versión de ensureDocenteAsignaturaAccess que también permite estudiantes (para lectura).
 * Docentes siguen teniendo la restricción de asignatura; estudiantes pasan sin restricción de asignatura.
 */
const allowStudentReadAccess = (req, asignaturaId) => {
  if (isAdmin(req) || req.tipoUsuario === 'ESTUDIANTE') {
    return; // estudiantes y admins pasan libremente
  }
  // Docentes: validar asignatura
  ensureDocenteAsignaturaAccess(req, asignaturaId);
};

module.exports = {
  ensureDocenteAsignaturaAccess,
  allowStudentReadAccess,
  resolveTemaAsignatura,
  resolveSubtemaAsignatura,
  resolveContenidoAsignatura,
  resolveSecuenciaSubtemaAsignatura,
  resolveSecuenciaContenidoAsignatura,
  buildDocenteSubtemaSequenceWhere,
  buildDocenteContenidoSequenceWhere,
  handleDocenteScopeError
};