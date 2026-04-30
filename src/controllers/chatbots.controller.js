const sequelize = require('../config/database');
const { Op } = require('sequelize');
const { Chatbot, ChatbotDocumento, Area, Miniproyecto, Persona } = require('../models');
const {
  deleteDocumentFile,
  removeChatbotFiles,
  ensureChatbotManager,
  reloadChatbotManager,
  invalidateChatbotManager,
} = require('../services/chatbotRegistry');
const {
  isNonEmptyString,
  sanitizePlainText,
  sanitizeRichText,
  removePersonaSensitiveFields,
} = require('../utils/inputSecurity');

const VALID_TYPES = new Set(['GENERAL', 'GENERAL_ADMINISTRADOR', 'GENERAL_DOCENTE', 'MINIPROYECTO']);
const ROLE_SCOPED_GENERAL_TYPES = new Set(['GENERAL_ADMINISTRADOR', 'GENERAL_DOCENTE']);

function isAdmin(req) {
  return req.tipoUsuario === 'ADMINISTRADOR';
}

function getTeacherAreaIds(req) {
  return Array.from(new Set((req.docenteAreaIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id))));
}

function canManageArea(req, areaId) {
  if (isAdmin(req)) return true;
  return getTeacherAreaIds(req).includes(Number(areaId));
}

function normalizeType(rawType) {
  const normalized = String(rawType || 'GENERAL').trim().toUpperCase();
  return VALID_TYPES.has(normalized) ? normalized : null;
}

function isRoleScopedGeneralType(type) {
  return ROLE_SCOPED_GENERAL_TYPES.has(type);
}

function isGeneralType(type) {
  return type === 'GENERAL' || isRoleScopedGeneralType(type);
}

function mapChatbotPayload(body) {
  const configuracion = body.configuracion || {};
  const rendimiento = body.parametros_rendimiento || {};

  return {
    nombre: body.nombre_chatbot ?? body.nombre,
    descripcion: body.descripcion,
    tipo: body.tipo,
    prompt_base: body.prompt_base,
    area_id: configuracion.area_id ?? body.area_id,
    miniproyecto_id: configuracion.miniproyecto_id ?? body.miniproyecto_id,
    provider: body.provider,
    model_name: rendimiento.model ?? body.model_name,
    top_k: rendimiento.topK ?? body.top_k,
    max_context_chars: rendimiento.max_context_chars ?? body.max_context_chars,
    max_tokens: rendimiento.max_tokens ?? body.max_tokens,
    temperature: rendimiento.temperature ?? body.temperature,
    estado: body.estado,
  };
}

function serializeChatbot(chatbot) {
  const plain = typeof chatbot.toJSON === 'function' ? chatbot.toJSON() : chatbot;
  if (plain.creador) {
    plain.creador = removePersonaSensitiveFields(plain.creador);
  }
  return plain;
}

async function ensureSingleActiveGlobalGeneralChatbot({ type, areaId, estado, currentChatbotId = null }) {
  if (type !== 'GENERAL' || Number.isFinite(Number(areaId)) || estado === false) {
    return null;
  }

  const existingGlobalChatbot = await Chatbot.findOne({
    where: {
      tipo: 'GENERAL',
      area_id: null,
      estado: true,
      ...(currentChatbotId ? { id: { [Op.ne]: currentChatbotId } } : {}),
    },
  });

  if (!existingGlobalChatbot) {
    return null;
  }

  return {
    status: 409,
    payload: {
      mensaje: 'Ya existe un chatbot general global activo para el dashboard estudiantil. Debes desactivarlo antes de activar otro.',
    },
  };
}

async function validateChatbotDependencies(req, payload, currentChatbot = null) {
  const type = normalizeType(payload.tipo ?? currentChatbot?.tipo ?? 'GENERAL');
  if (!type) {
    return { error: { status: 400, payload: { mensaje: 'tipo debe ser GENERAL, GENERAL_ADMINISTRADOR, GENERAL_DOCENTE o MINIPROYECTO' } } };
  }

  const areaId = payload.area_id !== undefined && payload.area_id !== null ? Number(payload.area_id) : (currentChatbot?.area_id ?? null);
  const miniproyectoId = payload.miniproyecto_id !== undefined && payload.miniproyecto_id !== null ? Number(payload.miniproyecto_id) : (currentChatbot?.miniproyecto_id ?? null);

  if (isRoleScopedGeneralType(type)) {
    if (!isAdmin(req)) {
      return { error: { status: 403, payload: { mensaje: 'Solo un administrador puede crear o modificar chatbots generales por rol' } } };
    }

    return { type, areaId: null, miniproyectoId: null };
  }

  if (type === 'GENERAL') {
    if (!isAdmin(req) && !Number.isFinite(areaId)) {
      return {
        error: {
          status: 400,
          payload: {
            mensaje: 'El chatbot general global del dashboard estudiantil solo puede ser gestionado por un administrador. Como docente debes asignar el chatbot general a una de tus áreas.',
          },
        },
      };
    }

    if (areaId !== null && Number.isFinite(areaId) && !canManageArea(req, areaId)) {
      return { error: { status: 403, payload: { mensaje: 'No tienes permisos para usar esa área' } } };
    }

    if (areaId !== null && Number.isFinite(areaId)) {
      const area = await Area.findByPk(areaId);
      if (!area) {
        return { error: { status: 404, payload: { mensaje: 'Área no encontrada' } } };
      }
    }

    return { type, areaId: Number.isFinite(areaId) ? areaId : null, miniproyectoId: null };
  }

  if (!Number.isFinite(areaId)) {
    return { error: { status: 400, payload: { mensaje: 'area_id es obligatorio para chatbots de tipo MINIPROYECTO' } } };
  }

  if (!canManageArea(req, areaId)) {
    return { error: { status: 403, payload: { mensaje: 'No tienes permisos para crear o modificar chatbots en esa área' } } };
  }

  const area = await Area.findByPk(areaId);
  if (!area) {
    return { error: { status: 404, payload: { mensaje: 'Área no encontrada' } } };
  }

  if (!Number.isFinite(miniproyectoId)) {
    return { error: { status: 400, payload: { mensaje: 'miniproyecto_id es obligatorio para chatbots de tipo MINIPROYECTO' } } };
  }

  const miniproyecto = await Miniproyecto.findByPk(miniproyectoId);
  if (!miniproyecto) {
    return { error: { status: 404, payload: { mensaje: 'Miniproyecto no encontrado' } } };
  }

  if (Number(miniproyecto.area_id) !== areaId) {
    return { error: { status: 400, payload: { mensaje: 'El miniproyecto seleccionado no pertenece al área indicada' } } };
  }

  return { type, areaId, miniproyectoId };
}

async function findManagedChatbot(req, chatbotId) {
  const chatbot = await Chatbot.findByPk(chatbotId, {
    include: [
      { model: Area, as: 'area' },
      { model: Miniproyecto, as: 'miniproyecto' },
      { model: Persona, as: 'creador' },
      { model: ChatbotDocumento, as: 'documentos' },
    ],
    order: [[{ model: ChatbotDocumento, as: 'documentos' }, 'createdAt', 'DESC']],
  });

  if (!chatbot) {
    return { error: { status: 404, payload: { mensaje: 'Chatbot no encontrado' } } };
  }

  if (!isAdmin(req) && !Number.isFinite(Number(chatbot.area_id))) {
    return { error: { status: 403, payload: { mensaje: 'Acceso denegado al chatbot solicitado' } } };
  }

  if (chatbot.area_id && !canManageArea(req, chatbot.area_id)) {
    return { error: { status: 403, payload: { mensaje: 'Acceso denegado al chatbot solicitado' } } };
  }

  return { chatbot };
}

async function findResolvedActiveChatbot({ tipo = 'GENERAL', areaId = null, miniproyectoId = null, allowFallback = true }) {
  const normalizedType = normalizeType(tipo) || 'GENERAL';
  const parsedAreaId = Number.isFinite(Number(areaId)) ? Number(areaId) : null;
  const parsedMiniproyectoId = Number.isFinite(Number(miniproyectoId)) ? Number(miniproyectoId) : null;
  const include = [
    { model: Area, as: 'area' },
    { model: Miniproyecto, as: 'miniproyecto' },
    { model: ChatbotDocumento, as: 'documentos' },
  ];

  if (normalizedType === 'MINIPROYECTO' && Number.isFinite(parsedMiniproyectoId)) {
    const miniproyectoChatbot = await Chatbot.findOne({
      where: {
        estado: true,
        tipo: 'MINIPROYECTO',
        miniproyecto_id: parsedMiniproyectoId,
        ...(Number.isFinite(parsedAreaId) ? { area_id: parsedAreaId } : {}),
      },
      include,
      order: [['updatedAt', 'DESC'], ['id', 'DESC']],
    });

    if (miniproyectoChatbot) {
      return miniproyectoChatbot;
    }

    if (!allowFallback) {
      return null;
    }
  }

  if (isRoleScopedGeneralType(normalizedType)) {
    const roleScopedChatbot = await Chatbot.findOne({
      where: {
        estado: true,
        tipo: normalizedType,
        area_id: null,
      },
      include,
      order: [['updatedAt', 'DESC'], ['id', 'DESC']],
    });

    if (roleScopedChatbot) {
      return roleScopedChatbot;
    }

    if (!allowFallback) {
      return null;
    }
  }

  if (Number.isFinite(parsedAreaId)) {
    const areaGeneralChatbot = await Chatbot.findOne({
      where: {
        estado: true,
        tipo: 'GENERAL',
        area_id: parsedAreaId,
      },
      include,
      order: [['updatedAt', 'DESC'], ['id', 'DESC']],
    });

    if (areaGeneralChatbot) {
      return areaGeneralChatbot;
    }

    if (!allowFallback && normalizedType === 'GENERAL') {
      return null;
    }
  }

  return Chatbot.findOne({
    where: {
      estado: true,
      tipo: 'GENERAL',
      area_id: null,
    },
    include,
    order: [['updatedAt', 'DESC'], ['id', 'DESC']],
  });
}

exports.resolveActiveChatbot = async (req, res) => {
  try {
    const tipo = normalizeType(req.query.tipo || 'GENERAL');
    if (!tipo) {
      return res.status(400).json({ mensaje: 'tipo debe ser GENERAL, GENERAL_ADMINISTRADOR, GENERAL_DOCENTE o MINIPROYECTO' });
    }

    const areaId = req.query.area_id !== undefined ? Number(req.query.area_id) : null;
    const miniproyectoId = req.query.miniproyecto_id !== undefined ? Number(req.query.miniproyecto_id) : null;
    const allowFallback = String(req.query.allow_fallback ?? 'true').toLowerCase() !== 'false';

    if (tipo === 'MINIPROYECTO' && !Number.isFinite(miniproyectoId)) {
      return res.status(400).json({ mensaje: 'miniproyecto_id es obligatorio para resolver un chatbot de miniproyecto' });
    }

    const chatbot = await findResolvedActiveChatbot({
      tipo,
      areaId,
      miniproyectoId,
      allowFallback,
    });

    if (!chatbot) {
      return res.status(404).json({ mensaje: 'No hay un chatbot activo disponible para este contexto' });
    }

    return res.json({
      id: chatbot.id,
      nombre: chatbot.nombre,
      tipo: chatbot.tipo,
      area_id: chatbot.area_id,
      miniproyecto_id: chatbot.miniproyecto_id,
      model_name: chatbot.model_name,
      documentos: (chatbot.documentos || []).length,
      fallback: isGeneralType(chatbot.tipo) && chatbot.tipo !== tipo,
      strict_mode: !allowFallback,
    });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al resolver chatbot', error: error.message });
  }
};

function chatbotMatchesContext(chatbot, expectedType, expectedAreaId, expectedMiniproyectoId) {
  if (!chatbot) return false;
  if (expectedType && String(chatbot.tipo) !== String(expectedType)) return false;
  if (expectedType === 'GENERAL_DOCENTE' || expectedType === 'GENERAL_ADMINISTRADOR') {
    // Chatbots generales por rol son globales por diseño (sin área/miniproyecto asociado).
    return true;
  }
  if (Number.isFinite(expectedAreaId) && Number(chatbot.area_id) !== Number(expectedAreaId)) return false;
  if (expectedType === 'MINIPROYECTO' && Number.isFinite(expectedMiniproyectoId) && Number(chatbot.miniproyecto_id) !== Number(expectedMiniproyectoId)) return false;
  return true;
}

exports.createChatbot = async (req, res) => {
  try {
    const payload = mapChatbotPayload(req.body);
    if (!isNonEmptyString(payload.nombre)) {
      return res.status(400).json({ mensaje: 'nombre_chatbot o nombre es obligatorio' });
    }

    const dependency = await validateChatbotDependencies(req, payload);
    if (dependency.error) {
      return res.status(dependency.error.status).json(dependency.error.payload);
    }

    const uniquenessError = await ensureSingleActiveGlobalGeneralChatbot({
      type: dependency.type,
      areaId: dependency.areaId,
      estado: payload.estado === undefined ? true : Boolean(payload.estado),
    });
    if (uniquenessError) {
      return res.status(uniquenessError.status).json(uniquenessError.payload);
    }

    const chatbot = await Chatbot.create({
      nombre: sanitizePlainText(payload.nombre),
      descripcion: payload.descripcion ? sanitizeRichText(payload.descripcion) : null,
      tipo: dependency.type,
      prompt_base: payload.prompt_base ? sanitizeRichText(payload.prompt_base) : null,
      area_id: dependency.areaId,
      miniproyecto_id: dependency.miniproyectoId,
      creado_por_persona_id: req.personaId,
      provider: isNonEmptyString(payload.provider) ? sanitizePlainText(payload.provider).toLowerCase() : (process.env.LLM_PROVIDER || (process.env.OLLAMA_BASE_URL ? 'ollama' : 'groq')),
      model_name: isNonEmptyString(payload.model_name) ? sanitizePlainText(payload.model_name) : (process.env.OLLAMA_MODEL || 'qwen2.5:0.5b'),
      top_k: Number.isFinite(Number(payload.top_k)) ? Math.max(1, Number(payload.top_k)) : 3,
      max_context_chars: Number.isFinite(Number(payload.max_context_chars)) ? Math.max(200, Number(payload.max_context_chars)) : 2400,
      max_tokens: Number.isFinite(Number(payload.max_tokens)) ? Math.max(64, Number(payload.max_tokens)) : 256,
      temperature: Number.isFinite(Number(payload.temperature)) ? Number(payload.temperature) : 0.2,
      estado: payload.estado === undefined ? true : Boolean(payload.estado),
    });

    const created = await Chatbot.findByPk(chatbot.id, {
      include: [
        { model: Area, as: 'area' },
        { model: Miniproyecto, as: 'miniproyecto' },
        { model: Persona, as: 'creador' },
        { model: ChatbotDocumento, as: 'documentos' },
      ],
    });

    return res.status(201).json(serializeChatbot(created));
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al crear chatbot', error: error.message });
  }
};

exports.getChatbots = async (req, res) => {
  try {
    const teacherAreaIds = getTeacherAreaIds(req);
    const where = isAdmin(req)
      ? {}
      : { area_id: teacherAreaIds };
    const chatbots = await Chatbot.findAll({
      where,
      include: [
        { model: Area, as: 'area' },
        { model: Miniproyecto, as: 'miniproyecto' },
        { model: Persona, as: 'creador' },
        { model: ChatbotDocumento, as: 'documentos' },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json(chatbots.map(serializeChatbot));
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener chatbots', error: error.message });
  }
};

exports.getChatbotById = async (req, res) => {
  try {
    const { chatbot, error } = await findManagedChatbot(req, req.params.id);
    if (error) {
      return res.status(error.status).json(error.payload);
    }

    return res.json(serializeChatbot(chatbot));
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener chatbot', error: error.message });
  }
};

exports.updateChatbot = async (req, res) => {
  try {
    const { chatbot, error } = await findManagedChatbot(req, req.params.id);
    if (error) {
      return res.status(error.status).json(error.payload);
    }

    const payload = mapChatbotPayload(req.body);
    const dependency = await validateChatbotDependencies(req, payload, chatbot);
    if (dependency.error) {
      return res.status(dependency.error.status).json(dependency.error.payload);
    }

    const uniquenessError = await ensureSingleActiveGlobalGeneralChatbot({
      type: dependency.type,
      areaId: dependency.areaId,
      estado: payload.estado === undefined ? chatbot.estado !== false : Boolean(payload.estado),
      currentChatbotId: chatbot.id,
    });
    if (uniquenessError) {
      return res.status(uniquenessError.status).json(uniquenessError.payload);
    }

    const updates = {
      tipo: dependency.type,
      area_id: dependency.areaId,
      miniproyecto_id: dependency.miniproyectoId,
    };

    if (payload.nombre !== undefined) {
      if (!isNonEmptyString(payload.nombre)) {
        return res.status(400).json({ mensaje: 'nombre no puede estar vacío' });
      }
      updates.nombre = sanitizePlainText(payload.nombre);
    }
    if (payload.descripcion !== undefined) updates.descripcion = payload.descripcion ? sanitizeRichText(payload.descripcion) : null;
    if (payload.prompt_base !== undefined) updates.prompt_base = payload.prompt_base ? sanitizeRichText(payload.prompt_base) : null;
    if (payload.provider !== undefined) updates.provider = sanitizePlainText(payload.provider).toLowerCase();
    if (payload.model_name !== undefined) updates.model_name = payload.model_name ? sanitizePlainText(payload.model_name) : chatbot.model_name;
    if (payload.top_k !== undefined) updates.top_k = Math.max(1, Number(payload.top_k));
    if (payload.max_context_chars !== undefined) updates.max_context_chars = Math.max(200, Number(payload.max_context_chars));
    if (payload.max_tokens !== undefined) updates.max_tokens = Math.max(64, Number(payload.max_tokens));
    if (payload.temperature !== undefined) updates.temperature = Number(payload.temperature);
    if (payload.estado !== undefined) updates.estado = Boolean(payload.estado);

    await chatbot.update(updates);
    invalidateChatbotManager(chatbot.id);

    const updated = await Chatbot.findByPk(chatbot.id, {
      include: [
        { model: Area, as: 'area' },
        { model: Miniproyecto, as: 'miniproyecto' },
        { model: Persona, as: 'creador' },
        { model: ChatbotDocumento, as: 'documentos' },
      ],
    });

    return res.json(serializeChatbot(updated));
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al actualizar chatbot', error: error.message });
  }
};

exports.deleteChatbot = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { chatbot, error } = await findManagedChatbot(req, req.params.id);
    if (error) {
      await transaction.rollback();
      return res.status(error.status).json(error.payload);
    }

    const documentos = await ChatbotDocumento.findAll({ where: { chatbot_id: chatbot.id }, transaction });
    for (const documento of documentos) {
      await documento.destroy({ transaction });
    }
    await chatbot.destroy({ transaction });
    await transaction.commit();

    for (const documento of documentos) {
      await deleteDocumentFile(documento);
    }
    await removeChatbotFiles(chatbot.id);
    invalidateChatbotManager(chatbot.id);
    return res.json({ mensaje: 'Chatbot eliminado correctamente' });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ mensaje: 'Error al eliminar chatbot', error: error.message });
  }
};

exports.getChatbotDocuments = async (req, res) => {
  try {
    const { chatbot, error } = await findManagedChatbot(req, req.params.id);
    if (error) {
      return res.status(error.status).json(error.payload);
    }
    return res.json(chatbot.documentos || []);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener documentos', error: error.message });
  }
};

exports.uploadChatbotDocument = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { chatbot, error } = await findManagedChatbot(req, req.params.id);
    if (error) {
      await transaction.rollback();
      return res.status(error.status).json(error.payload);
    }

    if (!req.file) {
      await transaction.rollback();
      return res.status(400).json({ mensaje: 'Debe adjuntar un archivo PDF' });
    }

    const documento = await ChatbotDocumento.create({
      chatbot_id: chatbot.id,
      nombre_archivo: `${Date.now()}_${String(req.file.originalname || 'documento.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')}`,
      nombre_original: req.file.originalname,
      // DB-first: no dependemos del filesystem local para reconstruir contexto en producción.
      ruta_archivo: null,
      mime_type: req.file.mimetype,
      tamano_bytes: req.file.size,
      contenido_pdf: req.file.buffer,
      estado: true,
    }, { transaction });
    await transaction.commit();

    const fresh = await Chatbot.findByPk(chatbot.id, { include: [{ model: ChatbotDocumento, as: 'documentos' }] });
    await reloadChatbotManager(fresh, fresh.documentos || []);
    return res.status(201).json(documento);
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ mensaje: 'Error al subir documento', error: error.message });
  }
};

exports.deleteChatbotDocument = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { chatbot, error } = await findManagedChatbot(req, req.params.id);
    if (error) {
      await transaction.rollback();
      return res.status(error.status).json(error.payload);
    }

    const documentId = Number(req.params.documentId);
    const documento = (chatbot.documentos || []).find((item) => Number(item.id) === documentId);
    if (!documento) {
      await transaction.rollback();
      return res.status(404).json({ mensaje: 'Documento no encontrado en el chatbot' });
    }

    await ChatbotDocumento.destroy({ where: { id: documentId }, transaction });
    await transaction.commit();
    await deleteDocumentFile(documento);

    const fresh = await Chatbot.findByPk(chatbot.id, { include: [{ model: ChatbotDocumento, as: 'documentos' }] });
    await reloadChatbotManager(fresh, fresh.documentos || []);
    return res.json({ mensaje: 'Documento eliminado correctamente' });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ mensaje: 'Error al eliminar documento', error: error.message });
  }
};

exports.reloadChatbotDocuments = async (req, res) => {
  try {
    const { chatbot, error } = await findManagedChatbot(req, req.params.id);
    if (error) {
      return res.status(error.status).json(error.payload);
    }

    const manager = await reloadChatbotManager(chatbot, chatbot.documentos || []);
    return res.json({ success: true, chatbotId: chatbot.id, stats: manager.getStats() });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al recargar documentos', error: error.message });
  }
};

exports.getChatbotStats = async (req, res) => {
  try {
    const { chatbot, error } = await findManagedChatbot(req, req.params.id);
    if (error) {
      return res.status(error.status).json(error.payload);
    }

    // Forzar recarga desde BD en cada pregunta para evitar cualquier mezcla por cache en memoria.
    const manager = await reloadChatbotManager(chatbot, chatbot.documentos || []);
    return res.json({
      success: true,
      chatbotId: chatbot.id,
      tipo: chatbot.tipo,
      area_id: chatbot.area_id,
      miniproyecto_id: chatbot.miniproyecto_id,
      documentos: (chatbot.documentos || []).length,
      ...manager.getStats(),
    });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener estadísticas', error: error.message });
  }
};

exports.getChatbotRetrievalPreview = async (req, res) => {
  try {
    const { chatbot, error } = await findManagedChatbot(req, req.params.id);
    if (error) {
      return res.status(error.status).json(error.payload);
    }

    const question = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!question) {
      return res.status(400).json({ mensaje: 'Debe enviar la consulta en el parámetro q' });
    }

    const topK = Number.isFinite(Number(req.query.topK)) ? Number(req.query.topK) : chatbot.top_k;
    // Forzar recarga desde BD en cada pregunta para evitar cualquier mezcla por cache en memoria.
    const manager = await reloadChatbotManager(chatbot, chatbot.documentos || []);
    const preview = await manager.debugRetrieval(question, topK);

    return res.json({
      success: true,
      chatbotId: chatbot.id,
      chatbotNombre: chatbot.nombre,
      tipo: chatbot.tipo,
      area_id: chatbot.area_id,
      miniproyecto_id: chatbot.miniproyecto_id,
      documentos: (chatbot.documentos || []).map((doc) => ({
        id: doc.id,
        nombre_original: doc.nombre_original,
        tamano_bytes: doc.tamano_bytes,
        estado: doc.estado,
      })),
      query: question,
      retrieval: preview,
    });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al previsualizar recuperación RAG', error: error.message });
  }
};

exports.chatWithManagedChatbot = async (req, res) => {
  try {
    const chatbot = await Chatbot.findByPk(req.params.id, { include: [{ model: ChatbotDocumento, as: 'documentos' }] });
    if (!chatbot || chatbot.estado === false) {
      return res.status(404).json({ success: false, error: 'Chatbot no encontrado o inactivo' });
    }

    const question = typeof req.body.question === 'string' ? req.body.question.trim() : '';
    if (!question) {
      return res.status(400).json({ success: false, error: 'La pregunta no puede estar vacía' });
    }

    // El chatbot objetivo lo define el :id de la URL. No bloqueamos por metadatos
    // de contexto enviados por el cliente para evitar conflictos falsos (409).

    const manager = await reloadChatbotManager(chatbot, chatbot.documentos || []);
    const effectiveTopK = Math.max(3, Number(chatbot.top_k || 3));
    const retrievalDebug = await manager.debugRetrieval(question, effectiveTopK);
    if (retrievalDebug?.success) {
      const brief = retrievalDebug.matches.slice(0, 3).map((m) => ({
        rank: m.rank,
        score: m.score,
        source_pdf: m.metadata?.source_pdf || m.metadata?.source || 'desconocido',
        chatbot_documento_id: m.metadata?.chatbot_documento_id ?? null,
      }));
      console.log(`[RAG DEBUG] chatbot=${chatbot.id} question="${question.slice(0, 80)}" topK=${effectiveTopK} chunks=${retrievalDebug.chunksLoaded} matches=${JSON.stringify(brief)}`);
    } else {
      console.warn(`[RAG DEBUG] chatbot=${chatbot.id} retrieval_error=${retrievalDebug?.error || 'sin_detalle'}`);
    }
    // Reutilizar el mismo manager ya construido, sin re-indexar.
    const result = await manager.chat(question, effectiveTopK);
    if (!result.success && typeof result.error === 'string' && result.error.toLowerCase().includes('timeout')) {
      return res.status(504).json(result);
    }

    const rawAnswer = resolveAnswerWithContextFallback(result.answer || '', retrievalDebug);
    const finalAnswer = looksLikeMarkdown(rawAnswer) ? rawAnswer : forceMarkdown(rawAnswer);

    return res.json({ chatbotId: chatbot.id, chatbotNombre: chatbot.nombre, success: result.success, answer: finalAnswer });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.chatWithManagedChatbotStream = async (req, res) => {
  try {
    const chatbot = await Chatbot.findByPk(req.params.id, { include: [{ model: ChatbotDocumento, as: 'documentos' }] });
    if (!chatbot || chatbot.estado === false) {
      return res.status(404).json({ success: false, error: 'Chatbot no encontrado o inactivo' });
    }

    const question = typeof req.body.question === 'string' ? req.body.question.trim() : '';
    if (!question) {
      return res.status(400).json({ success: false, error: 'La pregunta no puede estar vacía' });
    }

    // El chatbot objetivo lo define el :id de la URL. No bloqueamos por metadatos
    // de contexto enviados por el cliente para evitar conflictos falsos (409).

    res.status(200);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const manager = await reloadChatbotManager(chatbot, chatbot.documentos || []);
    const effectiveTopK = Math.max(3, Number(chatbot.top_k || 3));
    const retrievalDebug = await manager.debugRetrieval(question, effectiveTopK);
    if (retrievalDebug?.success) {
      const brief = retrievalDebug.matches.slice(0, 3).map((m) => ({
        rank: m.rank,
        score: m.score,
        source_pdf: m.metadata?.source_pdf || m.metadata?.source || 'desconocido',
        chatbot_documento_id: m.metadata?.chatbot_documento_id ?? null,
      }));
      console.log(`[RAG DEBUG] chatbot=${chatbot.id} question="${question.slice(0, 80)}" topK=${effectiveTopK} chunks=${retrievalDebug.chunksLoaded} matches=${JSON.stringify(brief)}`);
    } else {
      console.warn(`[RAG DEBUG] chatbot=${chatbot.id} retrieval_error=${retrievalDebug?.error || 'sin_detalle'}`);
    }
    // Reutilizar el mismo manager ya construido, sin re-indexar.
    const result = await manager.chat(question, effectiveTopK);
    const resolvedAnswer = resolveAnswerWithContextFallback(
      result.answer || result.error || 'No tengo esa información en los documentos cargados.',
      retrievalDebug,
    );
    res.write(transformStreamingChunk(String(resolvedAnswer || 'No tengo esa información en los documentos cargados.')));
    return res.end();
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.write(`\n\n${error.message}`);
    return res.end();
  }
};

// Helpers to detect and coerce plain text into a reasonable Markdown form.
function looksLikeMarkdown(text) {
  if (!text || typeof text !== 'string') return false;
  if (text.includes('\n')) return true;
  if (/\d+\.\s+/.test(text)) return true;
  if (/^[-*+]\s+/m.test(text)) return true;
  if (/\*\*.+\*\*/.test(text)) return true;
  return false;
}

function forceMarkdown(text) {
  if (!text || typeof text !== 'string') return text;
  let t = text.trim();

  // Insert newlines before inline numeric list markers
  t = t.replace(/\s+(?=\d+\.\s+)/g, '\n');

  // Bold common headings
  t = t.replace(/(^|\n)\s*(Objetivo|Contexto|Prioridades|Prioridad|Resumen|Resultado)\s*:\s*/gi, (m, p1, p2) => `\n**${p2.trim()}**: `);

  // If still single-line, split into sentences and make numbered list
  if (!t.includes('\n')) {
    const parts = t.split(/\.\s+/).map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      t = parts.map((p, i) => `${i + 1}. ${p}${p.endsWith('.') ? '' : '.'}`).join('\n');
    }
  }

  return t;
}

function transformStreamingChunk(chunk) {
  if (!chunk || typeof chunk !== 'string') return chunk;

  // Strip common fenced code markers for markdown (```markdown or ```)
  let c = chunk.replace(/```\s*markdown\s*/gi, '').replace(/```/g, '');

  // Remove leading accidental 'markdown -' or 'markdown:' prefixes
  c = c.replace(/^\s*markdown\s*[-:\s]+/i, '');

  // If the chunk contains inline numbered items like "1. ... 2. ...", insert newlines
  c = c.replace(/\s+(?=\d+\.\s+)/g, '\n');

  // Normalize leading list markers that might be joined: ensure a space after dash
  c = c.replace(/(^|\n)\s*-\s*/g, '\n- ');

  return c;
}

function resolveAnswerWithContextFallback(answer, retrievalDebug) {
  const fallbackText = 'No tengo esa información en los documentos cargados.';
  const normalized = String(answer || '').trim();
  const looksLikeNoInfo = normalized.toLowerCase().includes(fallbackText.toLowerCase());
  if (!looksLikeNoInfo) {
    return normalized || fallbackText;
  }

  const matches = Array.isArray(retrievalDebug?.matches) ? retrievalDebug.matches : [];
  const meaningfulMatches = matches.filter((match) => Number(match?.score || 0) >= 0.005);
  if (meaningfulMatches.length === 0) {
    return fallbackText;
  }

  const bullets = meaningfulMatches.slice(0, 2).map((match) => {
    const snippet = String(match?.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 220);
    return `- ${snippet}${snippet.endsWith('.') ? '' : '.'}`;
  });
  const source = meaningfulMatches[0]?.metadata?.source_pdf || 'documento cargado';

  return [
    `En los documentos cargados encontré información relacionada en **${source}**:`,
    ...bullets,
  ].join('\n');
}