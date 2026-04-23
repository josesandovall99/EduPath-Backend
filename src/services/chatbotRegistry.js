const fs = require('fs').promises;
const path = require('path');
const RAGManager = require('./RAGManager');

const managers = new Map();

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
  const baseConfig = {
    provider,
    modelName: chatbot.model_name || process.env.OLLAMA_MODEL || process.env.GROQ_MODEL || 'qwen2.5:0.5b',
    temperature: Number(chatbot.temperature ?? process.env.OLLAMA_TEMPERATURE ?? process.env.GROQ_TEMPERATURE ?? 0.2),
    maxTokens: Number(chatbot.max_tokens ?? process.env.OLLAMA_MAX_TOKENS ?? process.env.GROQ_MAX_TOKENS ?? 256),
    defaultTopK: Number(chatbot.top_k ?? 1),
    maxTopK: Number(chatbot.top_k ?? 1),
    maxContextChars: Number(chatbot.max_context_chars ?? process.env.CHATBOT_MAX_CONTEXT_CHARS ?? 600),
    chunkSize: parseInt(process.env.OLLAMA_CHUNK_SIZE || '1000', 10),
    chunkOverlap: parseInt(process.env.OLLAMA_CHUNK_OVERLAP || '200', 10),
    systemPrompt: chatbot.prompt_base || undefined,
  };

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
  for (const document of documents) {
    if (document.estado === false) continue;
    try {
      if (!document?.ruta_archivo) {
        console.warn('Documento sin ruta de archivo, se omite:', document && document.id ? document.id : document);
        continue;
      }
      await manager.loadPDFFromPath(document.ruta_archivo);
    } catch (err) {
      console.error(`Error cargando documento ${document?.ruta_archivo}:`, err.message || err);
      // continuar con los demás documentos en lugar de abortar la inicialización
    }
  }
}

async function ensureChatbotManager(chatbot, documents = []) {
  if (managers.has(chatbot.id)) {
    return managers.get(chatbot.id);
  }

  const manager = await createChatbotManager(chatbot);
  await loadDocumentsIntoManager(manager, documents);
  managers.set(chatbot.id, manager);
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