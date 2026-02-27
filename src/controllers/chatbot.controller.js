const RAGManager = require('../services/RAGManager');
const fs = require('fs').promises;
const path = require('path');

// Instancia global del RAGManager
let ragManager = null;

/**
 * Inicializar RAGManager al arrancar el servidor
 */
const initializeRAG = async () => {
    try {
        const useOllama = !!process.env.OLLAMA_BASE_URL;
        const useGroq = !!process.env.GROQ_API_KEY;

        if (!useOllama && !useGroq) {
            console.warn('⚠️ Ni OLLAMA_BASE_URL ni GROQ_API_KEY encontradas. El chatbot no estará disponible.');
            return;
        }

        // Debug simple: mostrar qué variables de entorno se detectaron (no mostrar claves)
        console.log(`🔎 Env detectados: OLLAMA_BASE_URL=${useOllama ? process.env.OLLAMA_BASE_URL : 'no'}, GROQ_API_KEY=${useGroq ? 'si' : 'no'}`);

        if (useOllama) {
            ragManager = new RAGManager({
                ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
                modelName: process.env.OLLAMA_MODEL || 'llama3.2',
                temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.2'),
                chunkSize: 1000,
                chunkOverlap: 200,
            });
        } else {
            ragManager = new RAGManager({
                groqApiKey: process.env.GROQ_API_KEY,
                modelName: 'llama-3.3-70b-versatile',
                temperature: 0.7,
                chunkSize: 1000,
                chunkOverlap: 200,
            });
        }

        // Intentar cargar PDFs existentes en uploads/chatbot-docs/
        const chatbotDocsPath = path.join(__dirname, '../../uploads/chatbot-docs');
        
        try {
            await fs.mkdir(chatbotDocsPath, { recursive: true });
            const files = await fs.readdir(chatbotDocsPath);
            const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

            if (pdfFiles.length > 0) {
                console.log(`\n📚 Cargando ${pdfFiles.length} PDF(s) existente(s)...`);
                
                for (const pdfFile of pdfFiles) {
                    const pdfPath = path.join(chatbotDocsPath, pdfFile);
                    try {
                        await ragManager.loadPDFFromPath(pdfPath);
                        console.log(`   ✓ ${pdfFile} cargado`);
                    } catch (error) {
                        console.error(`   ✗ Error cargando ${pdfFile}:`, error.message);
                    }
                }

                const stats = ragManager.getStats();
                console.log(`\n${stats.message}\n`);
            } else {
                console.log('\n📁 Carpeta chatbot-docs vacía. Esperando documentos...\n');
            }
        } catch (error) {
            console.log('📁 Creando carpeta chatbot-docs...\n');
        }

    } catch (error) {
        console.error('❌ Error inicializando RAGManager:', error.message);
    }
};

/**
 * Subir y procesar un PDF
 * POST /chatbot/upload
 */
const uploadPDF = async (req, res) => {
    try {
        if (!ragManager) {
            return res.status(503).json({ success: false, error: 'Chatbot no disponible. Verifica la configuración de OLLAMA_BASE_URL o GROQ_API_KEY en .env' });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó ningún archivo PDF',
            });
        }

        if (req.file.mimetype !== 'application/pdf') {
            return res.status(400).json({
                success: false,
                error: 'El archivo debe ser un PDF',
            });
        }

        // Procesar PDF
        const result = await ragManager.loadPDFFromBuffer(
            req.file.buffer,
            req.file.originalname
        );

        return res.status(200).json(result);

    } catch (error) {
        console.error('❌ Error en uploadPDF:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Hacer una pregunta al chatbot
 * POST /chatbot/chat
 * Body: { question: string, topK?: number }
 */
const chatWithBot = async (req, res) => {
    try {
        if (!ragManager) {
            return res.status(503).json({ success: false, error: 'Chatbot no disponible. Verifica la configuración de OLLAMA_BASE_URL o GROQ_API_KEY en .env' });
        }

        const { question, topK = 3 } = req.body;

        if (!question || question.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'La pregunta no puede estar vacía',
            });
        }

        const result = await ragManager.chat(question, topK);

        return res.status(200).json(result);

    } catch (error) {
        console.error('❌ Error en chatWithBot:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Obtener estadísticas del chatbot
 * GET /chatbot/stats
 */
const getStats = async (req, res) => {
    try {
        if (!ragManager) {
            return res.status(503).json({
                success: false,
                error: 'Chatbot no disponible',
            });
        }

        const stats = ragManager.getStats();
        
        return res.status(200).json({
            success: true,
            ...stats,
        });

    } catch (error) {
        console.error('❌ Error en getStats:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Limpiar la base de datos vectorial
 * DELETE /chatbot/clear
 */
const clearVectorStore = async (req, res) => {
    try {
        if (!ragManager) {
            return res.status(503).json({
                success: false,
                error: 'Chatbot no disponible',
            });
        }

        ragManager.clear();

        return res.status(200).json({
            success: true,
            message: 'Base de datos vectorial limpiada correctamente',
        });

    } catch (error) {
        console.error('❌ Error en clearVectorStore:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Recargar todos los PDFs de chatbot-docs
 * POST /chatbot/reload
 */
const reloadDocuments = async (req, res) => {
    try {
        if (!ragManager) {
            return res.status(503).json({
                success: false,
                error: 'Chatbot no disponible',
            });
        }

        // Limpiar vector store
        ragManager.clear();

        // Cargar PDFs
        const chatbotDocsPath = path.join(__dirname, '../../uploads/chatbot-docs');
        const files = await fs.readdir(chatbotDocsPath);
        const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

        const results = [];

        for (const pdfFile of pdfFiles) {
            const pdfPath = path.join(chatbotDocsPath, pdfFile);
            try {
                const result = await ragManager.loadPDFFromPath(pdfPath);
                results.push({ file: pdfFile, ...result });
            } catch (error) {
                results.push({
                    file: pdfFile,
                    success: false,
                    error: error.message,
                });
            }
        }

        const stats = ragManager.getStats();

        return res.status(200).json({
            success: true,
            message: `${pdfFiles.length} archivo(s) procesado(s)`,
            files: results,
            stats,
        });

    } catch (error) {
        console.error('❌ Error en reloadDocuments:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
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
