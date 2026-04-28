jest.useFakeTimers();

const path = require('path');

describe('chatbot.controller', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  function makeRes() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.setHeader = jest.fn();
    res.write = jest.fn();
    res.end = jest.fn(() => res);
    res.flushHeaders = jest.fn();
    return res;
  }

  test('chatWithBot devuelve 503 si ragManager no iniciado', async () => {
    const controller = require('../src/controllers/chatbot.controller');
    const req = { body: { question: 'Hola' } };
    const res = makeRes();

    await controller.chatWithBot(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  test('initializeRAG y chatWithBot: pregunta vacía devuelve 400', async () => {
    // Mock RAGManager constructor to provide expected methods
    const fakeManager = {
      loadPDFFromPath: jest.fn(),
      getStats: jest.fn(() => ({ message: '0 fragmento(s) cargado(s)' })),
      chat: jest.fn(async () => ({ success: true, answer: 'respuesta' })),
      clear: jest.fn(),
      loadPDFFromBuffer: jest.fn()
    };

    jest.doMock('../src/services/RAGManager', () => {
      return jest.fn().mockImplementation(() => fakeManager);
    });

    // Mock fs.promises to avoid touching disk
    const realFs = require('fs');
    jest.spyOn(realFs.promises, 'mkdir').mockResolvedValue();
    jest.spyOn(realFs.promises, 'readdir').mockResolvedValue([]);

    process.env.OLLAMA_BASE_URL = 'http://ollama.local';

    const controller = require('../src/controllers/chatbot.controller');
    // Initialize sets ragManager using mocked RAGManager
    await controller.initializeRAG();
    const req = { body: { question: '   ' } };
    const res = makeRes();

    await controller.chatWithBot(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  test('chatWithBot devuelve 200 con respuesta del RAGManager', async () => {
    const fakeManager = {
      loadPDFFromPath: jest.fn(),
      getStats: jest.fn(() => ({ message: 'ok' })),
      chat: jest.fn(async () => ({ success: true, answer: 'respuesta generada' })),
      clear: jest.fn(),
      loadPDFFromBuffer: jest.fn()
    };

    jest.resetModules();
    jest.resetModules();
    jest.doMock('../src/services/RAGManager', () => jest.fn().mockImplementation(() => fakeManager));

    const realFs2 = require('fs');
    jest.spyOn(realFs2.promises, 'mkdir').mockResolvedValue();
    jest.spyOn(realFs2.promises, 'readdir').mockResolvedValue([]);
    process.env.OLLAMA_BASE_URL = 'http://ollama.local';
    const controller = require('../src/controllers/chatbot.controller');
    await controller.initializeRAG();

    const req = { body: { question: '¿Qué es EduPath?' } };
    const res = makeRes();

    await controller.chatWithBot(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('chatWithBot devuelve 504 cuando el resultado contiene timeout', async () => {
    const fakeManager = {
      loadPDFFromPath: jest.fn(),
      getStats: jest.fn(() => ({ message: 'ok' })),
      chat: jest.fn(async () => ({ success: false, error: 'Timeout: Ollama tardó...' })),
      clear: jest.fn(),
      loadPDFFromBuffer: jest.fn()
    };

    jest.doMock('../src/services/RAGManager', () => jest.fn().mockImplementation(() => fakeManager));

    const realFs3 = require('fs');
    jest.spyOn(realFs3.promises, 'mkdir').mockResolvedValue();
    jest.spyOn(realFs3.promises, 'readdir').mockResolvedValue([]);
    process.env.OLLAMA_BASE_URL = 'http://ollama.local';
    const controller = require('../src/controllers/chatbot.controller');
    await controller.initializeRAG();
    const req = { body: { question: '¿tardará?' } };
    const res = makeRes();

    await controller.chatWithBot(req, res);
    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  test('uploadPDF valida ausencia de ragManager y manejo de tipos', async () => {
    const controller = require('../src/controllers/chatbot.controller');
    const res = makeRes();

    // sin ragManager
    await controller.uploadPDF({ file: null }, res);
    expect(res.status).toHaveBeenCalledWith(503);

    // Mock ragManager
    const fakeManager = { loadPDFFromBuffer: jest.fn(async () => ({ success: true })) };
    jest.doMock('../src/services/RAGManager', () => jest.fn().mockImplementation(() => fakeManager));

    const realFs4 = require('fs');
    jest.spyOn(realFs4.promises, 'mkdir').mockResolvedValue();
    jest.spyOn(realFs4.promises, 'readdir').mockResolvedValue([]);
    jest.spyOn(realFs4.promises, 'writeFile').mockResolvedValue();
    jest.spyOn(realFs4.promises, 'unlink').mockResolvedValue();
    process.env.OLLAMA_BASE_URL = 'http://ollama.local';
    const controller2 = require('../src/controllers/chatbot.controller');
    await controller2.initializeRAG();
    // file missing
    const res2 = makeRes();
    await controller2.uploadPDF({ file: null }, res2);
    expect(res2.status).toHaveBeenCalledWith(400);

    // wrong mimetype
    const res3 = makeRes();
    await controller2.uploadPDF({ file: { mimetype: 'text/plain', originalname: 'f.txt', buffer: Buffer.from('x') } }, res3);
    expect(res3.status).toHaveBeenCalledWith(400);

    // correct pdf
    const res4 = makeRes();
    const pdfFile = { mimetype: 'application/pdf', originalname: 'doc.pdf', buffer: Buffer.from('%PDF-1.4') };
    await controller2.uploadPDF({ file: pdfFile }, res4);
    expect(res4.status).toHaveBeenCalledWith(200);
  });

  test('clearVectorStore y getStats requieren ragManager', async () => {
    const controller = require('../src/controllers/chatbot.controller');
    const res = makeRes();
    await controller.clearVectorStore({}, res);
    expect(res.status).toHaveBeenCalledWith(503);

    // setup ragManager
    const fakeManager = { clear: jest.fn(), getStats: jest.fn(() => ({ message: 'ok' })) };
    jest.resetModules();
    jest.doMock('../src/services/RAGManager', () => jest.fn().mockImplementation(() => fakeManager));

    const realFs5 = require('fs');
    jest.spyOn(realFs5.promises, 'mkdir').mockResolvedValue();
    jest.spyOn(realFs5.promises, 'readdir').mockResolvedValue([]);
    jest.spyOn(realFs5.promises, 'writeFile').mockResolvedValue();
    jest.spyOn(realFs5.promises, 'unlink').mockResolvedValue();
    process.env.OLLAMA_BASE_URL = 'http://ollama.local';
    const controller2 = require('../src/controllers/chatbot.controller');
    await controller2.initializeRAG();
    const res2 = makeRes();
    await controller2.clearVectorStore({}, res2);
    expect(res2.status).toHaveBeenCalledWith(200);

    const res3 = makeRes();
    await controller2.getStats({}, res3);
    expect(res3.status).toHaveBeenCalledWith(200);
  });

    
  test('chatWithBotStream escribe chunks y termina', async () => {
    const fakeManager = {
      loadPDFFromPath: jest.fn(),
      getStats: jest.fn(() => ({ message: 'ok' })),
      chatStream: jest.fn(async (question, topK, onToken) => {
        await onToken('hola');
        await onToken(' mundo');
        return 'hola mundo';
      }),
      clear: jest.fn(),
      loadPDFFromBuffer: jest.fn()
    };

    jest.doMock('../src/services/RAGManager', () => jest.fn().mockImplementation(() => fakeManager));

    const realFs6 = require('fs');
    jest.spyOn(realFs6.promises, 'mkdir').mockResolvedValue();
    jest.spyOn(realFs6.promises, 'readdir').mockResolvedValue([]);
    process.env.OLLAMA_BASE_URL = 'http://ollama.local';

    const controller = require('../src/controllers/chatbot.controller');
    await controller.initializeRAG();

    const req = { body: { question: 'stream me' } };
    const res = makeRes();

    await controller.chatWithBotStream(req, res);
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.write).toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });
});
