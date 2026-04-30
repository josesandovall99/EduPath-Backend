const fs = require('fs').promises;
const path = require('path');
const RAGManager = require('./RAGManager');

const managers = new Map();

function buildFingerprint(chatbot, documents = []) {
  const chatbotPart = [
    chatbot?.id ?? '',
    chatbot?.updatedAt ? new Date(chatbot.updatedAt).toISOString() : '',
    chatbot?.provider ?? '',
    chatbot?.model_name ?? '',
    chatbot?.top_k ?? '',
    chatbot?.max_context_chars ?? '',
    chatbot?.max_tokens ?? '',
    chatbot?.temperature ?? '',
    chatbot?.prompt_base ?? '',
  ].join('|');

  const docsPart = (documents || [])
    .filter((doc) => doc?.estado !== false)
    .map((doc) => [
      doc?.id ?? '',
      doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : '',
      doc?.tamano_bytes ?? '',
      doc?.nombre_original ?? '',
    ].join(':'))
    .sort()
    .join(',');

  return `${chatbotPart}::${docsPart}`;
}

function getPreferredProviders(chatbot) {
  const preferred = String(chatbot.provider || process.env.LLM_PROVIDER || '').trim().toLowerCase();
  const hasOllama = !!process.env.OLLAMA_BASE_URL;
  const hasGroq = !!process.env.GROQ_API_KEY;
  const ordered = [];

  if (preferred === 'groq' && hasGroq) ordered.push('groq');
  if (preferred === 'ollama' && hasOllama) ordered.push('ollama');
  if (hasOllama && !ordered.includes('ollama')) ordered.push('ollama');
  if (hasGroq && !ordered.includes('groq')) ordered.push('groq');

  return ordered;
}

function buildManager(chatbot, provider) {
  const configuredTopK = Number(chatbot.top_k);
  const safeDefaultTopK = Number.isFinite(configuredTopK) && configuredTopK > 0 ? configuredTopK : 3;
  const safeMaxTopK = Math.max(safeDefaultTopK, Number(process.env.CHATBOT_MAX_TOP_K || 6));
  const configuredContextChars = Number(chatbot.max_context_chars);
  const safeMaxContextChars = Number.isFinite(configuredContextChars) && configuredContextChars >= 800
    ? configuredContextChars
    : Number(process.env.CHATBOT_MAX_CONTEXT_CHARS || 2400);

  const baseConfig = {
    provider,
    modelName: chatbot.model_name || process.env.OLLAMA_MODEL || process.env.GROQ_MODEL || 'qwen2.5:0.5b',
    temperature: Number(chatbot.temperature ?? process.env.OLLAMA_TEMPERATURE ?? process.env.GROQ_TEMPERATURE ?? 0.2),
    maxTokens: Number(chatbot.max_tokens ?? process.env.OLLAMA_MAX_TOKENS ?? process.env.GROQ_MAX_TOKENS ?? 256),
    defaultTopK: safeDefaultTopK,
    maxTopK: safeMaxTopK,
    maxContextChars: safeMaxContextChars,
    chunkSize: parseInt(process.env.OLLAMA_CHUNK_SIZE || '1000', 10),
    chunkOverlap: parseInt(process.env.OLLAMA_CHUNK_OVERLAP || '200', 10),
    systemPrompt: chatbot.prompt_base || undefined,
  };

  // Asegurar que, aunque exista un `prompt_base` personalizado, se incluya
  // una instrucción clara para que la respuesta del LLM sea en Markdown.
  if (baseConfig.systemPrompt) {
    baseConfig.systemPrompt = baseConfig.systemPrompt + '\n\nResponde en formato Markdown: usa listas numeradas o con viñetas cuando enumeres elementos, coloca cada ítem en su propia línea, usa **negritas** para títulos o puntos clave, y NO incluyas HTML ni etiquetas.';
  }

  if (provider === 'ollama') {
    return new RAGManager({
      ...baseConfig,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
    });
  }

  return new RAGManager({
    ...baseConfig,
    groqApiKey: process.env.GROQ_API_KEY,
  });
}

async function createChatbotManager(chatbot) {
  const providers = getPreferredProviders(chatbot);
  if (providers.length === 0) {
    throw new Error('No hay proveedor LLM configurado para este chatbot.');
  }

  return buildManager(chatbot, providers[0]);
}

function getChatbotDirectory(chatbotId) {
  return path.join(__dirname, '../../uploads/chatbots', String(chatbotId));
}

function sanitizeFilename(filename) {
  return String(filename || 'documento.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function saveDocumentFile(chatbotId, file) {
  const directory = getChatbotDirectory(chatbotId);
  await fs.mkdir(directory, { recursive: true });

  const filename = `${Date.now()}_${sanitizeFilename(file.originalname)}`;
  const filePath = path.join(directory, filename);
  await fs.writeFile(filePath, file.buffer);
  return { filename, filePath };
}

async function deleteDocumentFile(document) {
  if (!document?.ruta_archivo) return;
  await fs.unlink(document.ruta_archivo).catch(() => {});
}

async function removeChatbotFiles(chatbotId) {
  await fs.rm(getChatbotDirectory(chatbotId), { recursive: true, force: true }).catch(() => {});
}

async function loadDocumentsIntoManager(manager, documents) {
  const toPdfBuffer = (value) => {
    if (!value) return null;
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof Uint8Array) return Buffer.from(value);
    if (Array.isArray(value)) return Buffer.from(value);
    if (typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
      return Buffer.from(value.data);
    }
    if (typeof value === 'string') {
      try {
        return Buffer.from(value, 'base64');
      } catch (_) {
        return null;
      }
    }
    return null;
  };

  const loaded = [];
  const failed = [];

  for (const document of documents) {
    if (document.estado === false) continue;
    try {
      if (document.contenido_pdf) {
        // Usar el contenido almacenado en BD (persiste aunque el filesystem sea efímero)
        const buffer = toPdfBuffer(document.contenido_pdf);
        if (!buffer || buffer.length === 0) {
          throw new Error('contenido_pdf inválido o vacío');
        }
        await manager.loadPDFFromBuffer(
          buffer,
          document.nombre_original || 'documento.pdf',
          {
            chatbot_id: document.chatbot_id,
            chatbot_documento_id: document.id,
            nombre_original: document.nombre_original,
          },
        );
        loaded.push(document.id);
      } else if (document.ruta_archivo) {
        // Fallback para documentos anteriores sin contenido en BD
        await manager.loadPDFFromPath(document.ruta_archivo);
        loaded.push(document.id);
      } else {
        const reason = 'Documento sin contenido ni ruta';
        console.warn(`${reason}, se omite:`, document?.id);
        failed.push({ id: document?.id, reason });
      }
    } catch (err) {
      console.error(`Error cargando documento ${document?.id}:`, err.message || err);
      failed.push({ id: document?.id, reason: err?.message || 'Error desconocido' });
    }
  }

  return { loaded, failed };
}

async function ensureChatbotManager(chatbot, documents = []) {
  const fingerprint = buildFingerprint(chatbot, documents);
  const cached = managers.get(chatbot.id);
  if (cached && cached.fingerprint === fingerprint) {
    return cached.manager;
  }

  const manager = await createChatbotManager(chatbot);
  const loadSummary = await loadDocumentsIntoManager(manager, documents);
  const activeDocuments = documents.filter((doc) => doc.estado !== false);
  if (activeDocuments.length > 0 && loadSummary.loaded.length === 0) {
    const firstFailure = loadSummary.failed[0]?.reason || 'No fue posible procesar ningún documento.';
    throw new Error(`No se pudo indexar ningún PDF del chatbot ${chatbot.id}. ${firstFailure}`);
  }
  managers.set(chatbot.id, { manager, fingerprint });
  return manager;
}

async function reloadChatbotManager(chatbot, documents = []) {
  managers.delete(chatbot.id);
  return ensureChatbotManager(chatbot, documents);
}

function invalidateChatbotManager(chatbotId) {
  managers.delete(chatbotId);
}

module.exports = {
  saveDocumentFile,
  deleteDocumentFile,
  removeChatbotFiles,
  ensureChatbotManager,
  reloadChatbotManager,
  invalidateChatbotManager,
};