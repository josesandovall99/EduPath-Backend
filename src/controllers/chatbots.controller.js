const sequelize = require('../config/database');
const { Chatbot, ChatbotDocumento, Area, Persona } = require('../models');
const {
  saveDocumentFile,
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

function isAdmin(req) {
  return req.tipoUsuario === 'ADMINISTRADOR';
}

function getTeacherAreaIds(req) {
  return Array.from(
    new Set(
      (req.docenteAreaIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id))
    )
  );
}

function canManageArea(req, areaId) {
  if (isAdmin(req)) return true;
  return getTeacherAreaIds(req).includes(Number(areaId));
}

function serializeChatbot(chatbot) {
  const plain = typeof chatbot.toJSON === 'function' ? chatbot.toJSON() : chatbot;
  if (plain.creador) {
    plain.creador = removePersonaSensitiveFields(plain.creador);
  }
  return plain;
}

async function findManagedChatbot(req, chatbotId) {
  const chatbot = await Chatbot.findByPk(chatbotId, {
    include: [
      { model: Area, as: 'area' },
      { model: Persona, as: 'creador' },
      { model: ChatbotDocumento, as: 'documentos' },
    ],
    order: [[{ model: ChatbotDocumento, as: 'documentos' }, 'createdAt', 'DESC']],
  });

  if (!chatbot) {
    return { error: { status: 404, payload: { mensaje: 'Chatbot no encontrado' } } };
  }

  if (!canManageArea(req, chatbot.area_id)) {
    return { error: { status: 403, payload: { mensaje: 'Acceso denegado al chatbot solicitado' } } };
  }

  return { chatbot };
}

exports.createChatbot = async (req, res) => {
  try {
    const { nombre, descripcion, prompt_base, area_id, provider, model_name, temperature, top_k, max_tokens, estado } = req.body;

    if (!isNonEmptyString(nombre)) {
      return res.status(400).json({ mensaje: 'nombre es obligatorio' });
    }

    const areaId = Number(area_id);
    if (!Number.isFinite(areaId)) {
      return res.status(400).json({ mensaje: 'area_id es obligatorio y debe ser numérico' });
    }

    if (!canManageArea(req, areaId)) {
      return res.status(403).json({ mensaje: 'No tienes permisos para crear chatbots en esa área' });
    }

    const area = await Area.findByPk(areaId);
    if (!area) {
      return res.status(404).json({ mensaje: 'Área no encontrada' });
    }

    const chatbot = await Chatbot.create({
      nombre: sanitizePlainText(nombre),
      descripcion: descripcion ? sanitizeRichText(descripcion) : null,
      prompt_base: prompt_base ? sanitizeRichText(prompt_base) : null,
      area_id: areaId,
      creado_por_persona_id: req.personaId,
      provider: isNonEmptyString(provider) ? provider.trim().toLowerCase() : (process.env.LLM_PROVIDER || (process.env.OLLAMA_BASE_URL ? 'ollama' : 'groq')),
      model_name: isNonEmptyString(model_name) ? model_name.trim() : null,
      temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : 0.2,
      top_k: Number.isFinite(Number(top_k)) ? Math.max(1, Math.min(Number(top_k), 5)) : 3,
      max_tokens: Number.isFinite(Number(max_tokens)) ? Math.max(32, Number(max_tokens)) : 256,
      estado: estado === undefined ? true : Boolean(estado),
    });

    const created = await Chatbot.findByPk(chatbot.id, {
      include: [
        { model: Area, as: 'area' },
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
    const where = isAdmin(req)
      ? {}
      : { area_id: getTeacherAreaIds(req) };

    const chatbots = await Chatbot.findAll({
      where,
      include: [
        { model: Area, as: 'area' },
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

    if (req.body.area_id !== undefined) {
      const nextAreaId = Number(req.body.area_id);
      if (!Number.isFinite(nextAreaId)) {
        return res.status(400).json({ mensaje: 'area_id debe ser numérico' });
      }

      if (!canManageArea(req, nextAreaId)) {
        return res.status(403).json({ mensaje: 'No tienes permisos para mover el chatbot a esa área' });
      }

      const area = await Area.findByPk(nextAreaId);
      if (!area) {
        return res.status(404).json({ mensaje: 'Área no encontrada' });
      }
    }

    const updates = {};
    if (req.body.nombre !== undefined) {
      if (!isNonEmptyString(req.body.nombre)) {
        return res.status(400).json({ mensaje: 'nombre no puede estar vacío' });
      }
      updates.nombre = sanitizePlainText(req.body.nombre);
    }
    if (req.body.descripcion !== undefined) updates.descripcion = req.body.descripcion ? sanitizeRichText(req.body.descripcion) : null;
    if (req.body.prompt_base !== undefined) updates.prompt_base = req.body.prompt_base ? sanitizeRichText(req.body.prompt_base) : null;
    if (req.body.area_id !== undefined) updates.area_id = Number(req.body.area_id);
    if (req.body.provider !== undefined) updates.provider = sanitizePlainText(req.body.provider).toLowerCase();
    if (req.body.model_name !== undefined) updates.model_name = req.body.model_name ? sanitizePlainText(req.body.model_name) : null;
    if (req.body.temperature !== undefined) updates.temperature = Number(req.body.temperature);
    if (req.body.top_k !== undefined) updates.top_k = Math.max(1, Math.min(Number(req.body.top_k), 5));
    if (req.body.max_tokens !== undefined) updates.max_tokens = Math.max(32, Number(req.body.max_tokens));
    if (req.body.estado !== undefined) updates.estado = Boolean(req.body.estado);

    await chatbot.update(updates);
    invalidateChatbotManager(chatbot.id);

    const updated = await Chatbot.findByPk(chatbot.id, {
      include: [
        { model: Area, as: 'area' },
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

    const documentos = await ChatbotDocumento.findAll({
      where: { chatbot_id: chatbot.id },
      transaction,
    });

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
    return res.status(500).json({ mensaje: 'Error al obtener documentos del chatbot', error: error.message });
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

    const storedFile = await saveDocumentFile(chatbot.id, req.file);

    const documento = await ChatbotDocumento.create({
      chatbot_id: chatbot.id,
      nombre_archivo: storedFile.filename,
      nombre_original: req.file.originalname,
      ruta_archivo: storedFile.filePath,
      mime_type: req.file.mimetype,
      tamano_bytes: req.file.size,
      estado: true,
    }, { transaction });

    await transaction.commit();

    const freshChatbot = await Chatbot.findByPk(chatbot.id, {
      include: [{ model: ChatbotDocumento, as: 'documentos' }],
    });
    await reloadChatbotManager(freshChatbot, freshChatbot.documentos);

    return res.status(201).json(documento);
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ mensaje: 'Error al subir documento al chatbot', error: error.message });
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

    const freshChatbot = await Chatbot.findByPk(chatbot.id, {
      include: [{ model: ChatbotDocumento, as: 'documentos' }],
    });
    await reloadChatbotManager(freshChatbot, freshChatbot.documentos);

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
    return res.json({
      success: true,
      chatbotId: chatbot.id,
      stats: manager.getStats(),
    });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al recargar documentos del chatbot', error: error.message });
  }
};

exports.getChatbotStats = async (req, res) => {
  try {
    const { chatbot, error } = await findManagedChatbot(req, req.params.id);
    if (error) {
      return res.status(error.status).json(error.payload);
    }

    const manager = await ensureChatbotManager(chatbot, chatbot.documentos || []);
    return res.json({
      success: true,
      chatbotId: chatbot.id,
      documentos: (chatbot.documentos || []).length,
      ...manager.getStats(),
    });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener estadísticas del chatbot', error: error.message });
  }
};

exports.chatWithManagedChatbot = async (req, res) => {
  try {
    const chatbot = await Chatbot.findByPk(req.params.id, {
      include: [{ model: ChatbotDocumento, as: 'documentos' }],
    });

    if (!chatbot || chatbot.estado === false) {
      return res.status(404).json({ success: false, error: 'Chatbot no encontrado o inactivo' });
    }

    const question = typeof req.body.question === 'string' ? req.body.question.trim() : '';
    const requestedTopK = Number(req.body.topK);

    if (!question) {
      return res.status(400).json({ success: false, error: 'La pregunta no puede estar vacía' });
    }

    const manager = await ensureChatbotManager(chatbot, chatbot.documentos || []);
    const topK = Number.isFinite(requestedTopK) ? requestedTopK : chatbot.top_k;
    const result = await manager.chat(question, topK);

    return res.json({
      chatbotId: chatbot.id,
      chatbotNombre: chatbot.nombre,
      ...result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};