const fs = require('fs').promises;
const path = require('path');
const RAGManager = require('./RAGManager');

const managers = new Map();

function getPreferredProviders(chatbot) {
  const hasOllama = !!process.env.OLLAMA_BASE_URL;
  const hasGroq = !!process.env.GROQ_API_KEY;
  const preferred = (chatbot.provider || process.env.LLM_PROVIDER || '').trim().toLowerCase();
  const order = [];

  if (preferred === 'groq' && hasGroq) order.push('groq');
  if (preferred === 'ollama' && hasOllama) order.push('ollama');
  if (hasOllama && !order.includes('ollama')) order.push('ollama');
  if (hasGroq && !order.includes('groq')) order.push('groq');

  return order;
}

function buildManager(chatbot, provider) {
  const modelName = chatbot.model_name || process.env.OLLAMA_MODEL || process.env.GROQ_MODEL;
  const temperature = Number(chatbot.temperature ?? process.env.OLLAMA_TEMPERATURE ?? process.env.GROQ_TEMPERATURE ?? 0.2);
  const maxTokens = Number(chatbot.max_tokens ?? process.env.OLLAMA_MAX_TOKENS ?? 256);

  if (provider === 'ollama') {
    return new RAGManager({
      provider,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
      modelName: modelName || 'llama3.2',
      temperature,
      maxTokens,
      chunkSize: 1000,
      chunkOverlap: 200,
      systemPrompt: chatbot.prompt_base,
    });
  }

  return new RAGManager({
    provider,
    groqApiKey: process.env.GROQ_API_KEY,
    modelName: modelName || 'llama-3.3-70b-versatile',
    temperature,
    maxTokens,
    chunkSize: 1000,
    chunkOverlap: 200,
    systemPrompt: chatbot.prompt_base,
  });
}

async function createChatbotManager(chatbot) {
  const providerOrder = getPreferredProviders(chatbot);

  if (providerOrder.length === 0) {
    throw new Error('No hay proveedor LLM configurado para inicializar el chatbot');
  }

  let lastError = null;

  for (const provider of providerOrder) {
    const candidate = buildManager(chatbot, provider);

    if (provider === 'ollama') {
      const availability = await candidate.checkProviderAvailability();
      if (!availability.ok) {
        lastError = availability.error;
        continue;
      }
    }

    return candidate;
  }

  throw lastError || new Error('No se pudo inicializar el proveedor del chatbot');
}

function getChatbotDirectory(chatbotId) {
  return path.join(__dirname, '../../uploads/chatbots', String(chatbotId));
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function saveDocumentFile(chatbotId, file) {
  const directory = getChatbotDirectory(chatbotId);
  await fs.mkdir(directory, { recursive: true });

  const filename = `${Date.now()}_${sanitizeFilename(file.originalname)}`;
  const filePath = path.join(directory, filename);
  await fs.writeFile(filePath, file.buffer);

  return {
    filename,
    filePath,
  };
}

async function deleteDocumentFile(document) {
  if (!document?.ruta_archivo) return;
  await fs.unlink(document.ruta_archivo).catch(() => {});
}

async function removeChatbotFiles(chatbotId) {
  const directory = getChatbotDirectory(chatbotId);
  await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
}

async function loadDocumentsIntoManager(manager, documents) {
  for (const document of documents) {
    await manager.loadPDFFromPath(document.ruta_archivo);
  }
}

async function ensureChatbotManager(chatbot, documents) {
  if (managers.has(chatbot.id)) {
    return managers.get(chatbot.id);
  }

  const manager = await createChatbotManager(chatbot);
  const activeDocuments = (documents || []).filter((document) => document.estado !== false);

  if (activeDocuments.length > 0) {
    await loadDocumentsIntoManager(manager, activeDocuments);
  }

  managers.set(chatbot.id, manager);
  return manager;
}

async function reloadChatbotManager(chatbot, documents) {
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
  getChatbotDirectory,
};