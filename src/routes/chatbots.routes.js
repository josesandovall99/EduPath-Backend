const express = require('express');
const multer = require('multer');
const chatbotController = require('../controllers/chatbots.controller');
const autenticacionUsuario = require('../middlewares/autenticacionUsuario');
const requiereAdminODocente = require('../middlewares/requiereAdminODocente');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
      return;
    }

    cb(new Error('Solo se permiten archivos PDF'));
  },
});

router.post('/', autenticacionUsuario, requiereAdminODocente, chatbotController.createChatbot);
router.get('/', autenticacionUsuario, requiereAdminODocente, chatbotController.getChatbots);
router.get('/:id', autenticacionUsuario, requiereAdminODocente, chatbotController.getChatbotById);
router.put('/:id', autenticacionUsuario, requiereAdminODocente, chatbotController.updateChatbot);
router.delete('/:id', autenticacionUsuario, requiereAdminODocente, chatbotController.deleteChatbot);

router.get('/:id/documents', autenticacionUsuario, requiereAdminODocente, chatbotController.getChatbotDocuments);
router.post('/:id/documents', autenticacionUsuario, requiereAdminODocente, upload.single('pdf'), chatbotController.uploadChatbotDocument);
router.delete('/:id/documents/:documentId', autenticacionUsuario, requiereAdminODocente, chatbotController.deleteChatbotDocument);
router.post('/:id/reload', autenticacionUsuario, requiereAdminODocente, chatbotController.reloadChatbotDocuments);
router.get('/:id/stats', autenticacionUsuario, requiereAdminODocente, chatbotController.getChatbotStats);

router.post('/:id/chat', autenticacionUsuario, chatbotController.chatWithManagedChatbot);

module.exports = router;