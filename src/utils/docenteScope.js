const { Op } = require('sequelize');
const {
  Tema,
  Subtema,
  Contenido,
  SecuenciaSubtema,
  SecuenciaContenido
} = require('../models');

const toAllowedAreaIds = (req) => (
  Array.isArray(req.docenteAreaIds)
    ? req.docenteAreaIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
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

const ensureDocenteAreaAccess = (req, areaId) => {
  if (isAdmin(req)) {
    return;
  }

  if (!isDocente(req)) {
    throw buildScopedError(403, 'Acceso denegado: se requiere ser administrador o docente');
  }

  const allowedAreaIds = toAllowedAreaIds(req);
  if (allowedAreaIds.length === 0) {
    throw buildScopedError(401, 'No autorizado: áreas del docente no disponibles');
  }

  const normalizedAreaId = Number(areaId);
  if (!Number.isFinite(normalizedAreaId) || !allowedAreaIds.includes(normalizedAreaId)) {
    throw buildScopedError(403, 'Acceso denegado: área fuera de tu alcance', {
      areaIntentada: Number.isFinite(normalizedAreaId) ? normalizedAreaId : areaId,
      areasPermitidas: allowedAreaIds
    });
  }
};

const resolveTemaArea = async (temaId) => {
  const tema = await Tema.findByPk(temaId, { attributes: ['id', 'area_id', 'estado'] });
  if (!tema) {
    throw buildScopedError(404, 'Tema no encontrado');
  }

  return {
    temaId: Number(tema.id),
    areaId: Number(tema.area_id),
    estado: tema.estado !== false
  };
};

const resolveSubtemaArea = async (subtemaId) => {
  const subtema = await Subtema.findByPk(subtemaId, { attributes: ['id', 'tema_id', 'estado'] });
  if (!subtema) {
    throw buildScopedError(404, 'Subtema no encontrado');
  }

  const temaContext = await resolveTemaArea(subtema.tema_id);

  return {
    subtemaId: Number(subtema.id),
    temaId: temaContext.temaId,
    areaId: temaContext.areaId,
    estado: subtema.estado !== false
  };
};

const resolveContenidoArea = async (contenidoId) => {
  const contenido = await Contenido.findByPk(contenidoId, {
    attributes: ['id', 'tema_id', 'subtema_id', 'estado']
  });

  if (!contenido) {
    throw buildScopedError(404, 'Contenido no encontrado');
  }

  if (Number.isFinite(Number(contenido.tema_id))) {
    const temaContext = await resolveTemaArea(contenido.tema_id);
    return {
      contenidoId: Number(contenido.id),
      subtemaId: Number(contenido.subtema_id),
      temaId: temaContext.temaId,
      areaId: temaContext.areaId,
      estado: contenido.estado !== false
    };
  }

  if (Number.isFinite(Number(contenido.subtema_id))) {
    const subtemaContext = await resolveSubtemaArea(contenido.subtema_id);
    return {
      contenidoId: Number(contenido.id),
      subtemaId: subtemaContext.subtemaId,
      temaId: subtemaContext.temaId,
      areaId: subtemaContext.areaId,
      estado: contenido.estado !== false
    };
  }

  throw buildScopedError(400, 'El contenido no tiene una relación válida con un área');
};

const resolveSecuenciaSubtemaArea = async (sequenceId) => {
  const secuencia = await SecuenciaSubtema.findByPk(sequenceId, {
    attributes: ['id', 'subtema_origen_id', 'subtema_destino_id', 'estado']
  });

  if (!secuencia) {
    throw buildScopedError(404, 'Secuencia de subtema no encontrada');
  }

  const context = await resolveSubtemaArea(secuencia.subtema_origen_id);
  return { secuencia, ...context };
};

const resolveSecuenciaContenidoArea = async (sequenceId) => {
  const secuencia = await SecuenciaContenido.findByPk(sequenceId, {
    attributes: ['id', 'contenido_origen_id', 'contenido_destino_id', 'estado']
  });

  if (!secuencia) {
    throw buildScopedError(404, 'Secuencia de contenido no encontrada');
  }

  const context = await resolveContenidoArea(secuencia.contenido_origen_id);
  return { secuencia, ...context };
};

const buildDocenteSubtemaSequenceWhere = async (req) => {
  if (!isDocente(req)) {
    return {};
  }

  const allowedAreaIds = toAllowedAreaIds(req);
  if (allowedAreaIds.length === 0) {
    throw buildScopedError(401, 'No autorizado: áreas del docente no disponibles');
  }

  const temas = await Tema.findAll({
    where: { area_id: { [Op.in]: allowedAreaIds } },
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

  const allowedAreaIds = toAllowedAreaIds(req);
  if (allowedAreaIds.length === 0) {
    throw buildScopedError(401, 'No autorizado: áreas del docente no disponibles');
  }

  const temas = await Tema.findAll({
    where: { area_id: { [Op.in]: allowedAreaIds } },
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

module.exports = {
  ensureDocenteAreaAccess,
  resolveTemaArea,
  resolveSubtemaArea,
  resolveContenidoArea,
  resolveSecuenciaSubtemaArea,
  resolveSecuenciaContenidoArea,
  buildDocenteSubtemaSequenceWhere,
  buildDocenteContenidoSequenceWhere,
  handleDocenteScopeError
};