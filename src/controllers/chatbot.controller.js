const RAGManager = require('../services/RAGManager');
const fs = require('fs').promises;
const path = require('path');

let ragManager = null;

function buildRagManager() {
    if (process.env.OLLAMA_BASE_URL) {
        return new RAGManager({
            provider: 'ollama',
            ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
            modelName: process.env.OLLAMA_MODEL || 'llama3.2',
            temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.2'),
            maxTokens: parseInt(process.env.OLLAMA_MAX_TOKENS || '256', 10),
            chunkSize: parseInt(process.env.OLLAMA_CHUNK_SIZE || '1000', 10),
            chunkOverlap: parseInt(process.env.OLLAMA_CHUNK_OVERLAP || '200', 10),
        });
    }

    return new RAGManager({
        provider: 'groq',
        groqApiKey: process.env.GROQ_API_KEY,
        modelName: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        temperature: parseFloat(process.env.GROQ_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '256', 10),
        chunkSize: parseInt(process.env.OLLAMA_CHUNK_SIZE || '1000', 10),
        chunkOverlap: parseInt(process.env.OLLAMA_CHUNK_OVERLAP || '200', 10),
    });
}

const initializeRAG = async () => {
    try {
        const useOllama = !!process.env.OLLAMA_BASE_URL;
        const useGroq = !!process.env.GROQ_API_KEY;

        if (!useOllama && !useGroq) {
            console.warn('⚠️ Ni OLLAMA_BASE_URL ni GROQ_API_KEY encontradas. El chatbot no estará disponible.');
            return;
        }

        console.log(`🔎 Env detectados: OLLAMA_BASE_URL=${useOllama ? process.env.OLLAMA_BASE_URL : 'no'}, GROQ_API_KEY=${useGroq ? 'si' : 'no'}`);

        ragManager = buildRagManager();

        const chatbotDocsPath = path.join(__dirname, '../../uploads/chatbot-docs');
        await fs.mkdir(chatbotDocsPath, { recursive: true });
        const files = await fs.readdir(chatbotDocsPath);
        const pdfFiles = files.filter((file) => file.toLowerCase().endsWith('.pdf'));

        if (pdfFiles.length === 0) {
            console.log('📁 Carpeta chatbot-docs vacía. Esperando documentos...');
            return;
        }

        console.log(`📚 Cargando ${pdfFiles.length} PDF(s) existente(s)...`);
        for (const pdfFile of pdfFiles) {
            const pdfPath = path.join(chatbotDocsPath, pdfFile);
            try {
                await ragManager.loadPDFFromPath(pdfPath);
                console.log(`   ✓ ${pdfFile} cargado`);
            } catch (error) {
                console.error(`   ✗ Error cargando ${pdfFile}: ${error.message}`);
            }
        }

        const stats = ragManager.getStats();
        console.log(stats.message);
    } catch (err) {
        console.error('Error inicializando RAGManager:', err.message || err);
    }
};

const uploadPDF = async (req, res) => {
    try {
        if (!ragManager) {
            return res.status(503).json({ success: false, error: 'Chatbot no disponible. Verifica la configuración del proveedor LLM.' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No se proporcionó ningún archivo PDF' });
        }

        if (req.file.mimetype !== 'application/pdf') {
            return res.status(400).json({ success: false, error: 'El archivo debe ser un PDF' });
        }

        const chatbotDocsPath = path.join(__dirname, '../../uploads/chatbot-docs');
        await fs.mkdir(chatbotDocsPath, { recursive: true });

        const safeFilename = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const diskPath = path.join(chatbotDocsPath, safeFilename);
        await fs.writeFile(diskPath, req.file.buffer);

        const result = await ragManager.loadPDFFromBuffer(req.file.buffer, req.file.originalname);
        return res.status(200).json(result);
    } catch (error) {
        console.error('❌ Error en uploadPDF:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

const chatWithBot = async (req, res) => {
    try {
        if (!ragManager) {
            return res.status(503).json({ success: false, error: 'Chatbot no disponible. Verifica la configuración del proveedor LLM.' });
        }

        const { question, topK = 3 } = req.body;

        if (!question || question.trim() === '') {
            return res.status(400).json({ success: false, error: 'La pregunta no puede estar vacía' });
        }

        const result = await ragManager.chat(question, topK);

        if (!result.success && typeof result.error === 'string' && result.error.toLowerCase().includes('timeout')) {
            return res.status(504).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('❌ Error en chatWithBot:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

const getStats = async (req, res) => {
    try {
        if (!ragManager) {
            return res.status(503).json({ success: false, error: 'Chatbot no disponible' });
        }

        return res.status(200).json({ success: true, ...ragManager.getStats() });
    } catch (error) {
        console.error('❌ Error en getStats:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

const clearVectorStore = async (req, res) => {
    try {
        if (!ragManager) {
            return res.status(503).json({ success: false, error: 'Chatbot no disponible' });
        }

        ragManager.clear();
        return res.status(200).json({ success: true, message: 'Base de datos vectorial limpiada correctamente' });
    } catch (error) {
        console.error('❌ Error en clearVectorStore:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

const reloadDocuments = async (req, res) => {
    try {
        if (!ragManager) {
            return res.status(503).json({ success: false, error: 'Chatbot no disponible' });
        }

        ragManager.clear();

        const chatbotDocsPath = path.join(__dirname, '../../uploads/chatbot-docs');
        await fs.mkdir(chatbotDocsPath, { recursive: true });
        const files = await fs.readdir(chatbotDocsPath);
        const pdfFiles = files.filter((file) => file.toLowerCase().endsWith('.pdf'));

        const results = [];
        for (const pdfFile of pdfFiles) {
            const pdfPath = path.join(chatbotDocsPath, pdfFile);
            try {
                const result = await ragManager.loadPDFFromPath(pdfPath);
                results.push({ file: pdfFile, ...result });
            } catch (error) {
                results.push({ file: pdfFile, success: false, error: error.message });
            }
        }

        return res.status(200).json({
            success: true,
            message: `${pdfFiles.length} archivo(s) procesado(s)`,
            files: results,
            stats: ragManager.getStats(),
        });
    } catch (error) {
        console.error('❌ Error en reloadDocuments:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    initializeRAG,
    uploadPDF,
    chatWithBot,
    getStats,
    clearVectorStore,
    reloadDocuments,
};