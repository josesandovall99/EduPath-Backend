const express = require('express');
const multer = require('multer');
const {
    uploadPDF,
    chatWithBot,
    getStats,
    clearVectorStore,
    reloadDocuments,
} = require('../controllers/chatbot.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const requiereAdmin = require('../middlewares/requiereAdmin');

const router = express.Router();

// Configurar Multer para manejar PDFs en memoria
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB máximo
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF'), false);
        }
    },
});

/**
 * POST /chatbot/upload
 * Sube y procesa un PDF para agregarlo al chatbot
 * Body: FormData con campo 'pdf'
 */
router.post('/upload', autenticacionUsuario, requiereAdmin, upload.single('pdf'), uploadPDF);

/**
 * POST /chatbot/chat
 * Hace una pregunta al chatbot
 * Body: { question: string, topK?: number }
 */
router.post('/chat', autenticacionUsuario, chatWithBot);

/**
 * GET /chatbot/stats
 * Obtiene estadísticas del chatbot (documentos cargados, etc.)
 */
router.get('/stats', autenticacionUsuario, requiereAdmin, getStats);

/**
 * DELETE /chatbot/clear
 * Limpia la base de datos vectorial del chatbot
 */
router.delete('/clear', autenticacionUsuario, requiereAdmin, clearVectorStore);

/**
 * POST /chatbot/reload
 * Recarga todos los PDFs de la carpeta uploads/chatbot-docs/
 */
router.post('/reload', autenticacionUsuario, requiereAdmin, reloadDocuments);

module.exports = router;
