const db = require('../models');
const { Asignatura: AsignaturaModel, Actividad, Miniproyecto, TipoActividad, sequelize } = db;
const { Op } = require('sequelize');

const PILLAR_TYPES = new Set(['PROGRAMACION', 'ANALISIS', 'ATC']);

const normalizeasignaturaName = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const inferLegacyPillarType = (name) => {
  const normalizedName = normalizeasignaturaName(name);

  if (['fundamentos de programacion', 'fundamentos programacion'].includes(normalizedName)) {
    return 'PROGRAMACION';
  }

  if (['analisis de sistemas', 'analisis'].includes(normalizedName)) {
    return 'ANALISIS';
  }

  if (['atc', 'alcance tiempo y costo', 'alcance, tiempo y costo', 'gestion de proyectos', 'gestion proyectos'].includes(normalizedName)) {
    return 'ATC';
  }

  return null;
};

const normalizePillarType = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return PILLAR_TYPES.has(normalized) ? normalized : null;
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return null;
};

const isDocenteAllowedAsignaturaId = (req, asignaturaId) => {
  if (req.tipoUsuario !== 'DOCENTE') return true;
  const id = Number(asignaturaId);
  const allowed = Array.isArray(req.docenteAsignaturaIds)
    ? req.docenteAsignaturaIds.map((x) => Number(x)).filter((x) => Number.isFinite(x))
    : [];
  if (allowed.length > 0) return allowed.includes(id);
  if (req.docenteAsignaturaId != null && req.docenteAsignaturaId !== '') {
    return id === Number(req.docenteAsignaturaId);
  }
  return false;
};

const getEffectivePillarType = (AsignaturaLike) => normalizePillarType(AsignaturaLike?.tipo_pilar) || inferLegacyPillarType(AsignaturaLike?.nombre);

const isEffectivePillarAsignatura = (AsignaturaLike) => Boolean(AsignaturaLike?.es_asignatura_pilar) || getEffectivePillarType(AsignaturaLike) !== null;

const serializeAsignaturaResponse = (Asignatura) => {
  const payload = typeof Asignatura?.toJSON === 'function' ? Asignatura.toJSON() : Asignatura;
  return {
    ...payload,
    es_asignatura_pilar: isEffectivePillarAsignatura(payload),
    tipo_pilar: getEffectivePillarType(payload),
  };
};

const parseMiniproyectoPayload = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const isConfigurableMiniproyecto = (miniproyecto) => {
  const parsed = parseMiniproyectoPayload(miniproyecto?.respuesta_miniproyecto);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  return String(parsed.tipo || '').trim().toLowerCase() === 'configurable';
};

const buildLegacyTemplatePayload = (tipoPilar, asignaturaName) => {
  if (tipoPilar === 'PROGRAMACION') {
    return JSON.stringify({
      tipo: 'programacion',
      esperado: 'Implementa la solucion solicitada y valida los casos de prueba propuestos.',
      sintaxis: ['if', 'for', 'while'],
      lenguajesPermitidos: [62],
    });
  }

  if (tipoPilar === 'ATC') {
    return JSON.stringify({
      objetivoPrincipal: ['Definir el objetivo central del proyecto.'],
      objetivosEspecificos: ['Describir los objetivos especificos del proyecto.'],
      entregables: ['Listado inicial de entregables del proyecto.'],
      cronograma: [],
      costos: [],
      supuestos: ['Indica supuestos o restricciones relevantes.'],
    });
  }

  return JSON.stringify({
    stakeholders: ['Identifica los actores principales del sistema.'],
    requisitosFuncionales: ['Describe al menos un requisito funcional clave.'],
    requisitosNoFuncionales: ['Describe al menos un requisito no funcional clave.'],
  });
};

const buildLegacyTemplateMeta = (tipoPilar, asignaturaName) => {
  if (tipoPilar === 'PROGRAMACION') {
    return {
      titulo: `Plantilla base de Programacion - ${asignaturaName}`,
      descripcion: '<p>Miniproyecto base para el Asignatura principal de Programacion.</p>',
      nivel_dificultad: 'media',
      entregable: 'Codigo fuente funcional segun el enunciado.',
    };
  }

  if (tipoPilar === 'ATC') {
    return {
      titulo: `Plantilla base de ATC - ${asignaturaName}`,
      descripcion: '<p>Miniproyecto base para alcance, tiempo y costo.</p>',
      nivel_dificultad: 'media',
      entregable: 'Documento con objetivos, entregables, cronograma y costos.',
    };
  }

  return {
    titulo: `Plantilla base de Analisis - ${asignaturaName}`,
    descripcion: '<p>Miniproyecto base para levantamiento y analisis de requisitos.</p>',
    nivel_dificultad: 'media',
    entregable: 'Documento de stakeholders y requisitos.',
  };
};

const resolveMiniproyectoActivityTypeId = async (transaction) => {
  const existingMiniproyecto = await Miniproyecto.findOne({
    include: [{ model: Actividad, attributes: ['tipo_actividad_id'] }],
    order: [['id', 'ASC']],
    transaction,
  });

  const inheritedTypeId = Number(existingMiniproyecto?.Actividad?.tipo_actividad_id);
  if (Number.isInteger(inheritedTypeId) && inheritedTypeId > 0) {
    return inheritedTypeId;
  }

  const miniproyectoType = await TipoActividad.findOne({
    where: { nombre: { [Op.iLike]: '%miniproyecto%' } },
    order: [['id', 'ASC']],
    transaction,
  });

  const typeId = Number(miniproyectoType?.id);
  if (Number.isInteger(typeId) && typeId > 0) {
    return typeId;
  }

  throw Object.assign(new Error('No se pudo identificar el tipo de actividad para miniproyectos.'), { status: 500 });
};

const findPublishedLegacyMiniproyecto = async ({ Asignatura, transaction }) => {
  const publishedId = Number(Asignatura?.miniproyecto_publicado_id);
  if (!Number.isInteger(publishedId) || publishedId <= 0) return null;

  const miniproyecto = await Miniproyecto.findByPk(publishedId, {
    include: [{ model: Actividad }],
    transaction,
  });

  if (!miniproyecto) return null;
  if (Number(miniproyecto.asignatura_id) !== Number(Asignatura.id)) return null;
  if (miniproyecto.Actividad?.estado === false) return null;
  if (isConfigurableMiniproyecto(miniproyecto)) return null;
  return miniproyecto;
};

const ensurePillarTemplate = async ({ Asignatura, tipoPilar, transaction }) => {
  const currentTemplateId = Number(Asignatura?.miniproyecto_plantilla_id);
  if (Number.isInteger(currentTemplateId) && currentTemplateId > 0) {
    const existingTemplate = await Miniproyecto.findByPk(currentTemplateId, { transaction });
    if (!existingTemplate) {
      await Asignatura.update({ miniproyecto_plantilla_id: null }, { transaction });
    } else {
      if (Number(existingTemplate.asignatura_id) !== Number(Asignatura.id)) {
        throw Object.assign(new Error('La plantilla asociada no pertenece al Asignatura seleccionada.'), { status: 400 });
      }
      if (isConfigurableMiniproyecto(existingTemplate)) {
        throw Object.assign(new Error('La plantilla del Asignatura no puede ser un miniproyecto configurable.'), { status: 400 });
      }
      return existingTemplate.id;
    }
  }

  const publishedLegacy = await findPublishedLegacyMiniproyecto({ Asignatura, transaction });
  if (publishedLegacy) {
    await Asignatura.update({ miniproyecto_plantilla_id: publishedLegacy.id }, { transaction });
    return publishedLegacy.id;
  }

  const tipoActividadId = await resolveMiniproyectoActivityTypeId(transaction);
  const templateMeta = buildLegacyTemplateMeta(tipoPilar, Asignatura.nombre);
  const respuestaTemplate = buildLegacyTemplatePayload(tipoPilar, Asignatura.nombre);

  const actividad = await Actividad.create({
    titulo: templateMeta.titulo,
    descripcion: templateMeta.descripcion,
    nivel_dificultad: templateMeta.nivel_dificultad,
    fecha_creacion: new Date(),
    tipo_actividad_id: tipoActividadId,
  }, { transaction });

  const miniproyecto = await Miniproyecto.create({
    id: actividad.id,
    actividad_id: actividad.id,
    asignatura_id: Asignatura.id,
    entregable: templateMeta.entregable,
    respuesta_miniproyecto: respuestaTemplate,
  }, { transaction });

  await Asignatura.update({ miniproyecto_plantilla_id: miniproyecto.id }, { transaction });
  return miniproyecto.id;
};

const ensureUniqueActivePillarAsignatura = async (tipoPilar, excludeId = null) => {
  const activeasignaturas = await AsignaturaModel.findAll({ where: { estado: true } });
  const duplicate = activeasignaturas.find((asignatura) => (
    Number(asignatura.id) !== Number(excludeId) && getEffectivePillarType(asignatura) === tipoPilar
  ));

  if (duplicate) {
    throw Object.assign(
      new Error(`Ya existe un asignatura principal para ${tipoPilar}: ${duplicate.nombre}.`),
      { status: 409 }
    );
  }
};

const canViewInactiveasignaturas = (req) => ['ADMINISTRADOR', 'DOCENTE'].includes(req.tipoUsuario);

// Docente o admin: activar/desactivar desbloqueo progresivo por asignatura
exports.patchProgresionSecuencial = async (req, res) => {
  try {
    const asignaturaId = parseInt(req.params.id, 10);
    if (!Number.isFinite(asignaturaId)) {
      return res.status(400).json({ message: 'ID de asignatura inválido' });
    }

    const val = parseBoolean(req.body?.progresion_secuencial);
    if (val === null) {
      return res.status(400).json({ message: 'Envía progresion_secuencial como booleano.' });
    }

    if (!['ADMINISTRADOR', 'DOCENTE'].includes(req.tipoUsuario)) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    if (req.tipoUsuario === 'DOCENTE' && !isDocenteAllowedAsignaturaId(req, asignaturaId)) {
      return res.status(403).json({ message: 'No puedes modificar esta asignatura.' });
    }

    const asignatura = await AsignaturaModel.findByPk(asignaturaId);
    if (!asignatura) return res.status(404).json({ message: 'Asignatura no encontrada' });

    await asignatura.update({ progresion_secuencial: val });
    res.json(serializeAsignaturaResponse(asignatura));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al actualizar la progresión', error });
  }
};

// Crear un asignatura (solo ADMINISTRADOR)
exports.createAsignatura = async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || '').trim();
    const descripcion = String(req.body?.descripcion || '').trim();
    const requestedPillarFlag = parseBoolean(req.body?.es_asignatura_pilar);
    const requestedPillarType = normalizePillarType(req.body?.tipo_pilar);
    const isPillarAsignatura = requestedPillarFlag === true || requestedPillarType !== null;

    if (!nombre) {
      return res.status(400).json({ message: 'El nombre del asignatura es obligatorio.' });
    }

    if (isPillarAsignatura && !requestedPillarType) {
      return res.status(400).json({ message: 'Debes seleccionar el tipo de asignatura principal.' });
    }

    if (requestedPillarFlag === false && requestedPillarType) {
      return res.status(400).json({ message: 'No puedes indicar un tipo principal si el asignatura no es principal.' });
    }

    if (requestedPillarType) {
      await ensureUniqueActivePillarAsignatura(requestedPillarType);
    }

    const transaction = await sequelize.transaction();

    try {
      const asignatura = await AsignaturaModel.create({
        nombre,
        descripcion: descripcion || null,
        es_asignatura_pilar: isPillarAsignatura,
        tipo_pilar: isPillarAsignatura ? requestedPillarType : null,
        progresion_secuencial: parseBoolean(req.body?.progresion_secuencial) === true,
      }, { transaction });

      if (isPillarAsignatura && requestedPillarType) {
        await ensurePillarTemplate({ Asignatura: asignatura, tipoPilar: requestedPillarType, transaction });
      }

      await transaction.commit();
      res.status(201).json(serializeAsignaturaResponse(asignatura));
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error al crear el asignatura', error });
  }
};

// Listar todas las asignaturas
exports.getAsignaturas = async (req, res) => {
  try {
    const where = {};

    if (!canViewInactiveasignaturas(req)) {
      where.estado = true;
    }
    
    // Admin ve todas las asignaturas
    // Docente ve solo su asignatura
    if (req.tipoUsuario === "DOCENTE") {
      const allowedasignaturaIds = Array.isArray(req.docenteAsignaturaIds)
        ? req.docenteAsignaturaIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
        : [];

      if (allowedasignaturaIds.length > 0) {
        where.id = allowedasignaturaIds;
      } else if (req.docenteAsignaturaId) {
        where.id = req.docenteAsignaturaId;
      }
    }
    // Administrador no tiene restricción
    // Otros tipos de usuario (estudiante) tampoco tienen restricción en GET

    const asignaturas = await AsignaturaModel.findAll({ where });
    res.json(asignaturas.map(serializeAsignaturaResponse));
  } catch (error) {
    res.status(500).json({ message: "Error al obtener las asignaturas", error });
  }
};

// Obtener un asignatura por ID
exports.getAsignaturaById = async (req, res) => {
  try {
    // Docente solo puede ver su propia asignatura
    if (req.tipoUsuario === "DOCENTE") {
      const requestedasignaturaId = parseInt(req.params.id, 10);
      const allowedasignaturaIds = Array.isArray(req.docenteAsignaturaIds)
        ? req.docenteAsignaturaIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
        : [];

      const isAllowed = allowedasignaturaIds.length > 0
        ? allowedasignaturaIds.includes(requestedasignaturaId)
        : (req.docenteAsignaturaId ? requestedasignaturaId === parseInt(req.docenteAsignaturaId, 10) : true);

      if (!isAllowed) {
        return res.status(403).json({ message: "Acceso denegado: asignatura fuera de tu alcance" });
      }
    }

    const where = { id: req.params.id };
    if (!canViewInactiveasignaturas(req)) {
      where.estado = true;
    }

    const asignatura = await AsignaturaModel.findOne({ where });
    if (!asignatura) return res.status(404).json({ message: "Asignatura no encontrada" });
    res.json(serializeAsignaturaResponse(asignatura));
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el asignatura", error });
  }
};

// Obtener asignaturas permitidas para el docente autenticado
exports.getMisAsignaturasDocente = async (req, res) => {
  try {
    const allowedasignaturaIds = Array.isArray(req.docenteAsignaturaIds)
      ? req.docenteAsignaturaIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];

    if (allowedasignaturaIds.length === 0) {
      return res.status(403).json({ message: "Acceso denegado: asignatura fuera de tu alcance" });
    }

    const asignaturas = await AsignaturaModel.findAll({ where: { id: allowedasignaturaIds, estado: true } });
    res.json(asignaturas.map(serializeAsignaturaResponse));
  } catch (error) {
    res.status(500).json({ message: "Error al obtener las asignaturas del docente", error });
  }
};

// Actualizar un asignatura (solo ADMINISTRADOR)
exports.updateAsignatura = async (req, res) => {
  try {
    const asignatura = await AsignaturaModel.findByPk(req.params.id);
    if (!asignatura) return res.status(404).json({ message: "Asignatura no encontrada" });

    const payload = { ...req.body };
    delete payload.estado;

    const currentEffectivePillarType = getEffectivePillarType(asignatura);
    const currentEffectivePillarFlag = isEffectivePillarAsignatura(asignatura);
    const nextName = payload.nombre !== undefined ? String(payload.nombre || '').trim() : asignatura.nombre;
    const nextDescription = payload.descripcion !== undefined ? String(payload.descripcion || '').trim() : asignatura.descripcion;
    const requestedPillarFlag = payload.es_asignatura_pilar !== undefined ? parseBoolean(payload.es_asignatura_pilar) : currentEffectivePillarFlag;
    const requestedPillarType = payload.tipo_pilar !== undefined
      ? normalizePillarType(payload.tipo_pilar)
      : currentEffectivePillarType;

    if (!nextName) {
      return res.status(400).json({ message: 'El nombre del asignatura es obligatorio.' });
    }

    if (requestedPillarFlag && !requestedPillarType) {
      return res.status(400).json({ message: 'Debes seleccionar el tipo de asignatura principal.' });
    }

    if (!requestedPillarFlag && payload.tipo_pilar !== undefined && requestedPillarType) {
      return res.status(400).json({ message: 'No puedes indicar un tipo principal si el asignatura no es principal.' });
    }

    if (requestedPillarFlag && requestedPillarType) {
      await ensureUniqueActivePillarAsignatura(requestedPillarType, asignatura.id);
    }

    let nextProgresionSecuencial;
    if (payload.progresion_secuencial !== undefined) {
      const parsed = parseBoolean(payload.progresion_secuencial);
      if (parsed === null) {
        return res.status(400).json({ message: 'progresion_secuencial debe ser un valor booleano.' });
      }
      nextProgresionSecuencial = parsed;
    }

    const transaction = await sequelize.transaction();

    try {
      const updateFields = {
        nombre: nextName,
        descripcion: nextDescription || null,
        es_asignatura_pilar: Boolean(requestedPillarFlag),
        tipo_pilar: requestedPillarFlag ? requestedPillarType : null,
      };
      if (nextProgresionSecuencial !== undefined) {
        updateFields.progresion_secuencial = nextProgresionSecuencial;
      }

      await asignatura.update(updateFields, { transaction });

      if (requestedPillarFlag && requestedPillarType) {
        await ensurePillarTemplate({ Asignatura: asignatura, tipoPilar: requestedPillarType, transaction });
      }

      await transaction.commit();
      res.json(serializeAsignaturaResponse(asignatura));
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error al actualizar el asignatura', error });
  }
};

// Eliminar un asignatura (solo ADMINISTRADOR)
exports.deleteAsignatura = async (req, res) => {
  try {
    const asignatura = await AsignaturaModel.findByPk(req.params.id);
    if (!asignatura) return res.status(404).json({ message: "Asignatura no encontrada" });

    if (asignatura.estado === false) {
      return res.json({ message: 'Asignatura ya estaba inhabilitada' });
    }

    await asignatura.update({ estado: false });
    res.json({ message: "Asignatura inhabilitada correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al inhabilitar el asignatura", error });
  }
};

exports.toggleEstadoAsignatura = async (req, res) => {
  try {
    const asignatura = await AsignaturaModel.findByPk(req.params.id);
    if (!asignatura) return res.status(404).json({ message: 'Asignatura no encontrada' });

    const nuevoEstado = asignatura.estado === false;
    await asignatura.update({ estado: nuevoEstado });

    res.json({
      message: `Asignatura ${nuevoEstado ? 'habilitada' : 'inhabilitada'} correctamente`,
      estado: nuevoEstado,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar el estado del asignatura', error });
  }
};
