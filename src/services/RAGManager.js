const { ChatGroq } = require('@langchain/groq');
const { PDFLoader } = require('@langchain/community/document_loaders/fs/pdf');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { RunnableSequence } = require('@langchain/core/runnables');
const fs = require('fs').promises;
const path = require('path');

function getTimeoutSignal(timeoutMs) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        return AbortSignal.timeout(timeoutMs);
    }

    return undefined;
}


/**
 * Cliente HTTP para Ollama (PC B)
 * Maneja la comunicación directa por red local sin depender de librerías externas.
 */
class OllamaHTTPClient {
    constructor({ baseUrl, model, temperature = 0.2, maxTokens = 2048 }) {
        this.baseUrl = baseUrl.replace(/\/+$/g, '');
        this.model = model;
        this.temperature = temperature;
        this.maxTokens = maxTokens;
        this.generateTimeoutMs = Number(process.env.OLLAMA_GENERATE_TIMEOUT_MS || 60000);
    }

    async generate(prompt, options = {}) {
        const payload = {
            model: options.model || this.model,
            prompt,
            temperature: options.temperature ?? this.temperature,
            num_predict: options.maxTokens || this.maxTokens,
            stream: false // Importante para recibir respuesta completa
        };

        // Probamos los dos endpoints más comunes de Ollama
        const endpoints = ['/api/generate', '/v1/completions'];
        let lastError = null;

        for (const ep of endpoints) {
            const url = `${this.baseUrl}${ep}`;
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: getTimeoutSignal(this.generateTimeoutMs),
                });

                if (res.ok) {
                    const json = await res.json();
                    console.log(` ℹ️ Ollama respondió vía ${ep}`);
                    // Extraer texto dependiendo del formato del endpoint
                    return json.response || json.choices?.[0]?.text || json.output || JSON.stringify(json);
                }
            } catch (err) {
                lastError = err;
            }
        }

        if (lastError?.name === 'TimeoutError' || lastError?.name === 'AbortError') {
            throw new Error(`Timeout: Ollama tardó más de ${Math.round(this.generateTimeoutMs / 1000)} segundos en responder.`);
        }

        throw new Error(`PC B no responde en ${this.baseUrl}. Verifica que Ollama esté corriendo. Detalle: ${lastError?.message}`);
    }
}

/**
 * Búsqueda de Vectores Local (PC A)
 */
class SimpleVectorStore {
    constructor() {
        this.documents = [];
        this.idfScores = {};
    }

    tokenize(text) {
        return text.toLowerCase()
            .replace(/[^\w\sáéíóúñü]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2);
    }

    calculateTF(tokens) {
        const tf = {};
        tokens.forEach(t => tf[t] = (tf[t] || 0) + 1);
        Object.keys(tf).forEach(k => tf[k] = tf[k] / tokens.length);
        return tf;
    }

    calculateIDF() {
        const docCount = this.documents.length;
        const df = {};
        this.documents.forEach(d => new Set(d.tokens).forEach(t => df[t] = (df[t] || 0) + 1));
        Object.keys(df).forEach(t => {
            this.idfScores[t] = Math.log(docCount / df[t]);
        });
    }

    async addDocuments(docs) {
        docs.forEach(doc => {
            const tokens = this.tokenize(doc.pageContent);
            const tf = this.calculateTF(tokens);
            this.documents.push({ 
                pageContent: doc.pageContent, 
                metadata: doc.metadata, 
                tokens, 
                tf, 
                tfidf: {} 
            });
        });
        this.calculateIDF();
        this.documents.forEach(d => {
            d.tokens.forEach(t => d.tfidf[t] = d.tf[t] * (this.idfScores[t] || 0));
        });
    }

    cosineSimilarity(query, doc) {
        const qtokens = this.tokenize(query);
        const qtf = this.calculateTF(qtokens);
        let dot = 0, qmag = 0, dmag = 0;

        qtokens.forEach(t => {
            const qv = qtf[t] * (this.idfScores[t] || 1);
            const dv = doc.tfidf[t] || 0;
            dot += qv * dv;
            qmag += qv * qv;
        });
        Object.values(doc.tfidf).forEach(v => dmag += v * v);
        qmag = Math.sqrt(qmag); dmag = Math.sqrt(dmag);
        return (qmag === 0 || dmag === 0) ? 0 : dot / (qmag * dmag);
    }

    async similaritySearch(query, k = 3) {
        const sims = this.documents.map(doc => ({ doc, score: this.cosineSimilarity(query, doc) }));
        return sims.sort((a, b) => b.score - a.score).slice(0, k).map(s => s.doc);
    }
}

/**
 * Clase Principal RAGManager
 */
class RAGManager {
    constructor(config = {}) {
        this.config = config;
        // Priorizar Ollama si existen las variables en el .env
        this.provider = config.provider || (config.ollamaBaseUrl ? 'ollama' : 'groq');
        
        this.vectorStore = new SimpleVectorStore();
        this.textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: config.chunkSize || 1000,
            chunkOverlap: config.chunkOverlap || 200
        });

        if (this.provider === 'ollama') {
            this.llm = new OllamaHTTPClient({
                baseUrl: config.ollamaBaseUrl,
                model: config.modelName || 'llama3.2',
                temperature: config.temperature || 0.2
            });
        } else {
            this.llm = new ChatGroq({
                apiKey: config.groqApiKey,
                model: config.modelName || 'llama-3.3-70b-versatile'
            });
        }

        this.promptTemplate = PromptTemplate.fromTemplate(`
            Eres un asistente educativo experto y amigable del sistema EduPath.
            CONTEXTO RELEVANTE extraído del PDF:
            {context}

            PREGUNTA DEL ESTUDIANTE: {question}

            INSTRUCCIONES:
            - Responde SOLO basándote en el contexto proporcionado.
            - Si la información no está en el contexto, di: "No tengo esa información en los documentos cargados".
            - Sé claro y educativo.
            - Responde de forma breve, idealmente en 3 a 6 líneas.
            RESPUESTA:`);
        
        console.log(`✅ RAGManager configurado correctamente`);
        console.log(` 🚀 Destino LLM: ${this.provider === 'ollama' ? config.ollamaBaseUrl : 'Groq Cloud'}`);
    }

    // Método para cargar PDFs desde memoria (Subidas desde Web/React)
    async loadPDFFromBuffer(pdfBuffer, filename = 'documento.pdf') {
        const tempPath = path.join(__dirname, `temp_${Date.now()}.pdf`);
        await fs.writeFile(tempPath, pdfBuffer);
        try {
            const loader = new PDFLoader(tempPath);
            const docs = await loader.load();
            const splitDocs = await this.textSplitter.splitDocuments(docs);
            await this.vectorStore.addDocuments(splitDocs);
            return { success: true, message: 'PDF cargado', chunks: splitDocs.length };
        } catch (error) {
            console.error("❌ Error procesando buffer:", error.message);
            throw error;
        } finally {
            await fs.unlink(tempPath).catch(() => {});
        }
    }

    // Método para cargar PDFs desde una ruta local (Archivos existentes en PC A)
    async loadPDFFromPath(pdfPath) {
        try {
            const buffer = await fs.readFile(pdfPath);
            const filename = path.basename(pdfPath);
            return await this.loadPDFFromBuffer(buffer, filename);
        } catch (error) {
            console.error(`❌ Error cargando PDF desde ruta: ${pdfPath}`, error.message);
            throw error;
        }
    }

    async chat(question, topK = 3) {
        try {
            if (this.vectorStore.documents.length === 0) {
                return { success: false, answer: "No hay documentos cargados para responder." };
            }

            const safeTopK = Math.max(1, Math.min(Number(topK) || 3, 5));
            
            // 1. Buscar fragmentos relevantes en PC A
            const relevantDocs = await this.vectorStore.similaritySearch(question, safeTopK);
            const context = relevantDocs.map(d => d.pageContent).join('\n\n---\n\n');
            
            // 2. Preparar el prompt
            const finalPrompt = this.promptTemplate.template
                .replace('{context}', context)
                .replace('{question}', question);

            // 3. Enviar a PC B
            let answer;
            if (this.provider === 'ollama') {
                answer = await this.llm.generate(finalPrompt);
            } else {
                const chain = RunnableSequence.from([this.llm, new StringOutputParser()]);
                answer = await chain.invoke(finalPrompt);
            }

            return { success: true, answer };
        } catch (error) {
            console.error("❌ Error en chat RAG:", error.message);
            return { success: false, error: error.message };
        }
    }


    getStats() {
        const documentCount = this.vectorStore.documents.length;
        return {
            provider: this.provider,
            model: this.provider === 'ollama' ? this.llm.model : this.config.modelName || 'llama-3.3-70b-versatile',
            isLoaded: documentCount > 0,
            documentsCount: documentCount,
            chunksLoaded: documentCount,
            message: `${documentCount} fragmento(s) cargado(s) en memoria para el chatbot.`,
        };
    }


    clear() { this.vectorStore = new SimpleVectorStore(); }
}

module.exports = RAGManager;