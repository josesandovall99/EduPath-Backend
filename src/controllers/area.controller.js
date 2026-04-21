const db = require('../models');
const { Area, Actividad, Miniproyecto, TipoActividad, sequelize } = db;
const { Op } = require('sequelize');

const PILLAR_TYPES = new Set(['PROGRAMACION', 'ANALISIS', 'ATC']);

const normalizeAreaName = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const inferLegacyPillarType = (name) => {
  const normalizedName = normalizeAreaName(name);

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

const getEffectivePillarType = (areaLike) => normalizePillarType(areaLike?.tipo_pilar) || inferLegacyPillarType(areaLike?.nombre);

const isEffectivePillarArea = (areaLike) => Boolean(areaLike?.es_area_pilar) || getEffectivePillarType(areaLike) !== null;

const serializeAreaResponse = (area) => {
  const payload = typeof area?.toJSON === 'function' ? area.toJSON() : area;
  return {
    ...payload,
    es_area_pilar: isEffectivePillarArea(payload),
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

const buildLegacyTemplatePayload = (tipoPilar, areaName) => {
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

const buildLegacyTemplateMeta = (tipoPilar, areaName) => {
  if (tipoPilar === 'PROGRAMACION') {
    return {
      titulo: `Plantilla base de Programacion - ${areaName}`,
      descripcion: '<p>Miniproyecto base para el area principal de Programacion.</p>',
      nivel_dificultad: 'media',
      entregable: 'Codigo fuente funcional segun el enunciado.',
    };
  }

  if (tipoPilar === 'ATC') {
    return {
      titulo: `Plantilla base de ATC - ${areaName}`,
      descripcion: '<p>Miniproyecto base para alcance, tiempo y costo.</p>',
      nivel_dificultad: 'media',
      entregable: 'Documento con objetivos, entregables, cronograma y costos.',
    };
  }

  return {
    titulo: `Plantilla base de Analisis - ${areaName}`,
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

const findPublishedLegacyMiniproyecto = async ({ area, transaction }) => {
  const publishedId = Number(area?.miniproyecto_publicado_id);
  if (!Number.isInteger(publishedId) || publishedId <= 0) return null;

  const miniproyecto = await Miniproyecto.findByPk(publishedId, {
    include: [{ model: Actividad }],
    transaction,
  });

  if (!miniproyecto) return null;
  if (Number(miniproyecto.area_id) !== Number(area.id)) return null;
  if (miniproyecto.Actividad?.estado === false) return null;
  if (isConfigurableMiniproyecto(miniproyecto)) return null;
  return miniproyecto;
};

const ensurePillarTemplate = async ({ area, tipoPilar, transaction }) => {
  const currentTemplateId = Number(area?.miniproyecto_plantilla_id);
  if (Number.isInteger(currentTemplateId) && currentTemplateId > 0) {
    const existingTemplate = await Miniproyecto.findByPk(currentTemplateId, { transaction });
    if (!existingTemplate) {
      throw Object.assign(new Error('La plantilla asociada al area no existe.'), { status: 400 });
    }
    if (Number(existingTemplate.area_id) !== Number(area.id)) {
      throw Object.assign(new Error('La plantilla asociada no pertenece al area seleccionada.'), { status: 400 });
    }
    if (isConfigurableMiniproyecto(existingTemplate)) {
      throw Object.assign(new Error('La plantilla del area no puede ser un miniproyecto configurable.'), { status: 400 });
    }
    return existingTemplate.id;
  }

  const publishedLegacy = await findPublishedLegacyMiniproyecto({ area, transaction });
  if (publishedLegacy) {
    await area.update({ miniproyecto_plantilla_id: publishedLegacy.id }, { transaction });
    return publishedLegacy.id;
  }

  const tipoActividadId = await resolveMiniproyectoActivityTypeId(transaction);
  const templateMeta = buildLegacyTemplateMeta(tipoPilar, area.nombre);
  const respuestaTemplate = buildLegacyTemplatePayload(tipoPilar, area.nombre);

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
    area_id: area.id,
    entregable: templateMeta.entregable,
    respuesta_miniproyecto: respuestaTemplate,
  }, { transaction });

  await area.update({ miniproyecto_plantilla_id: miniproyecto.id }, { transaction });
  return miniproyecto.id;
};

const ensureUniqueActivePillarArea = async (tipoPilar, excludeId = null) => {
  const activeAreas = await Area.findAll({ where: { estado: true } });
  const duplicate = activeAreas.find((area) => (
    Number(area.id) !== Number(excludeId) && getEffectivePillarType(area) === tipoPilar
  ));

  if (duplicate) {
    throw Object.assign(
      new Error(`Ya existe un área principal para ${tipoPilar}: ${duplicate.nombre}.`),
      { status: 409 }
    );
  }
};

const canViewInactiveAreas = (req) => ['ADMINISTRADOR', 'DOCENTE'].includes(req.tipoUsuario);

// Crear un área (solo ADMINISTRADOR)
exports.createArea = async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || '').trim();
    const descripcion = String(req.body?.descripcion || '').trim();
    const requestedPillarFlag = parseBoolean(req.body?.es_area_pilar);
    const requestedPillarType = normalizePillarType(req.body?.tipo_pilar);
    const isPillarArea = requestedPillarFlag === true || requestedPillarType !== null;

    if (!nombre) {
      return res.status(400).json({ message: 'El nombre del área es obligatorio.' });
    }

    if (isPillarArea && !requestedPillarType) {
      return res.status(400).json({ message: 'Debes seleccionar el tipo de área principal.' });
    }

    if (requestedPillarFlag === false && requestedPillarType) {
      return res.status(400).json({ message: 'No puedes indicar un tipo principal si el área no es principal.' });
    }

    if (requestedPillarType) {
      await ensureUniqueActivePillarArea(requestedPillarType);
    }

    const transaction = await sequelize.transaction();

    try {
      const area = await Area.create({
        nombre,
        descripcion: descripcion || null,
        es_area_pilar: isPillarArea,
        tipo_pilar: isPillarArea ? requestedPillarType : null,
      }, { transaction });

      if (isPillarArea && requestedPillarType) {
        await ensurePillarTemplate({ area, tipoPilar: requestedPillarType, transaction });
      }

      await transaction.commit();
      res.status(201).json(serializeAreaResponse(area));
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error al crear el área', error });
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
    res.json(areas.map(serializeAreaResponse));
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
    res.json(serializeAreaResponse(area));
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
    res.json(areas.map(serializeAreaResponse));
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

    const currentEffectivePillarType = getEffectivePillarType(area);
    const currentEffectivePillarFlag = isEffectivePillarArea(area);
    const nextName = payload.nombre !== undefined ? String(payload.nombre || '').trim() : area.nombre;
    const nextDescription = payload.descripcion !== undefined ? String(payload.descripcion || '').trim() : area.descripcion;
    const requestedPillarFlag = payload.es_area_pilar !== undefined ? parseBoolean(payload.es_area_pilar) : currentEffectivePillarFlag;
    const requestedPillarType = payload.tipo_pilar !== undefined
      ? normalizePillarType(payload.tipo_pilar)
      : currentEffectivePillarType;

    if (!nextName) {
      return res.status(400).json({ message: 'El nombre del área es obligatorio.' });
    }

    if (requestedPillarFlag && !requestedPillarType) {
      return res.status(400).json({ message: 'Debes seleccionar el tipo de área principal.' });
    }

    if (!requestedPillarFlag && payload.tipo_pilar !== undefined && requestedPillarType) {
      return res.status(400).json({ message: 'No puedes indicar un tipo principal si el área no es principal.' });
    }

    if (requestedPillarFlag && requestedPillarType) {
      await ensureUniqueActivePillarArea(requestedPillarType, area.id);
    }

    const transaction = await sequelize.transaction();

    try {
      await area.update({
        nombre: nextName,
        descripcion: nextDescription || null,
        es_area_pilar: Boolean(requestedPillarFlag),
        tipo_pilar: requestedPillarFlag ? requestedPillarType : null,
      }, { transaction });

      if (requestedPillarFlag && requestedPillarType) {
        await ensurePillarTemplate({ area, tipoPilar: requestedPillarType, transaction });
      }

      await transaction.commit();
      res.json(serializeAreaResponse(area));
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error al actualizar el área', error });
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
