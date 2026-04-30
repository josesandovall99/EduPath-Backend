const { ChatGroq } = require('@langchain/groq');
const { PDFLoader } = require('@langchain/community/document_loaders/fs/pdf');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { RunnableSequence } = require('@langchain/core/runnables');
const fs = require('fs').promises;
const path = require('path');
const { Readable } = require('stream');

function getTimeoutSignal(timeoutMs) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        return AbortSignal.timeout(timeoutMs);
    }

    return undefined;
}

function nowMs() {
    return Date.now();
}

function logTiming(label, startedAt) {
    const elapsedMs = nowMs() - startedAt;
    console.log(`${label}: ${elapsedMs} ms`);
}

function normalizeTopK(topK, maxTopK = 1, defaultTopK = 1) {
    return Math.max(1, Math.min(Number(topK) || defaultTopK, maxTopK));
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
        this.generateTimeoutMs = Number(process.env.OLLAMA_GENERATE_TIMEOUT_MS || 120000);
        this.streamStartTimeoutMs = Number(process.env.OLLAMA_STREAM_START_TIMEOUT_MS || 120000);
    }

    async generate(prompt, options = {}) {
        const generationStart = nowMs();
        const endpoint = '/api/generate';
        const url = `${this.baseUrl}${endpoint}`;
        const payload = {
            model: options.model || this.model,
            prompt,
            stream: false,
            options: {
                temperature: options.temperature ?? this.temperature,
                num_predict: options.maxTokens || this.maxTokens,
            },
        };

        try {
            console.log(`Enviando prompt a Ollama | endpoint: ${endpoint} | model: ${payload.model} | prompt chars: ${prompt.length} | timeout ms: ${this.generateTimeoutMs}`);
            const requestStart = nowMs();
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: getTimeoutSignal(this.generateTimeoutMs),
            });
            logTiming(`Ollama ${endpoint} HTTP`, requestStart);

            if (!res.ok) {
                logTiming('Generación LLM total con error', generationStart);
                throw new Error(`HTTP ${res.status} en ${endpoint}`);
            }

            const json = await res.json();
            console.log(`Ollama respondió vía ${endpoint}`);
            logTiming('Generación LLM total', generationStart);
            return json.response || json.choices?.[0]?.text || json.output || JSON.stringify(json);
        } catch (lastError) {
            if (lastError?.name === 'TimeoutError' || lastError?.name === 'AbortError') {
                logTiming('Generación LLM total con timeout', generationStart);
                throw new Error(`Timeout: Ollama tardó más de ${Math.round(this.generateTimeoutMs / 1000)} segundos en responder.`);
            }

            logTiming('Generación LLM total con error', generationStart);
            throw new Error(`PC B no responde en ${this.baseUrl}. Verifica que Ollama esté corriendo. Detalle: ${lastError?.message}`);
        }
    }

    async generateStream(prompt, onToken, options = {}) {
        const generationStart = nowMs();
        const endpoint = '/api/generate';
        const url = `${this.baseUrl}${endpoint}`;
        const payload = {
            model: options.model || this.model,
            prompt,
            stream: true,
            options: {
                temperature: options.temperature ?? this.temperature,
                num_predict: options.maxTokens || this.maxTokens,
            },
        };

        try {
            console.log(`Enviando prompt streaming a Ollama | endpoint: ${endpoint} | model: ${payload.model} | prompt chars: ${prompt.length} | start timeout ms: ${this.streamStartTimeoutMs}`);
            const requestStart = nowMs();
            // Use an AbortController with a timeout only for the initial request start.
            // Once the response headers arrive, clear the timeout so streaming isn't aborted mid-response.
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.streamStartTimeoutMs);
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            logTiming(`Ollama ${endpoint} stream start`, requestStart);

            if (!res.ok) {
                logTiming('Generación LLM stream con error', generationStart);
                throw new Error(`HTTP ${res.status} en ${endpoint}`);
            }

            if (!res.body) {
                logTiming('Generación LLM stream con error', generationStart);
                throw new Error('Ollama no devolvió un cuerpo de respuesta en streaming.');
            }

            const nodeStream = Readable.fromWeb(res.body);
            nodeStream.setEncoding('utf8');

            let buffer = '';
            let answer = '';

            await new Promise((resolve, reject) => {
                let chain = Promise.resolve();

                nodeStream.on('data', (chunkText) => {
                    buffer += chunkText;
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;

                        chain = chain.then(async () => {
                            const parsed = JSON.parse(trimmed);
                            const chunk = parsed.response || '';
                            if (chunk) {
                                // Some LLM streaming endpoints return the entire partial
                                // answer repeatedly (cumulative). To avoid duplicating
                                // previously-sent text on the client, compute the delta
                                // relative to the answer we already have and send only
                                // the new suffix.
                                let delta = chunk;
                                if (chunk.startsWith(answer)) {
                                    delta = chunk.slice(answer.length);
                                    answer = chunk;
                                } else {
                                    answer += delta;
                                }

                                if (delta) {
                                    await onToken(delta);
                                }
                            }
                        });
                    }
                });

                nodeStream.on('end', () => {
                    chain.then(async () => {
                        if (buffer.trim()) {
                            const parsed = JSON.parse(buffer.trim());
                            const chunk = parsed.response || '';
                            if (chunk) {
                                let delta = chunk;
                                if (chunk.startsWith(answer)) {
                                    delta = chunk.slice(answer.length);
                                    answer = chunk;
                                } else {
                                    answer += delta;
                                }

                                if (delta) {
                                    await onToken(delta);
                                }
                            }
                        }
                        resolve();
                    }).catch(reject);
                });

                nodeStream.on('error', reject);
            });

            logTiming('Generación LLM stream total', generationStart);
            return answer;
        } catch (error) {
            if (error?.name === 'AbortError') {
                logTiming('Generación LLM stream con timeout', generationStart);
                throw new Error(`Timeout: Ollama tardó más de ${Math.round(this.streamStartTimeoutMs / 1000)} segundos en iniciar la respuesta.`);
            }

            if (error?.name === 'TimeoutError') {
                logTiming('Generación LLM stream con timeout', generationStart);
                throw new Error(`Timeout: Ollama tardó más de ${Math.round(this.streamStartTimeoutMs / 1000)} segundos en iniciar la respuesta.`);
            }

            logTiming('Generación LLM stream con error', generationStart);
            throw new Error(`PC B no responde en ${this.baseUrl}. Verifica que Ollama esté corriendo. Detalle: ${error?.message}`);
        }
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

    async similaritySearchWithScores(query, k = 3) {
        const sims = this.documents.map((doc) => ({ doc, score: this.cosineSimilarity(query, doc) }));
        return sims.sort((a, b) => b.score - a.score).slice(0, k);
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
        this.defaultTopK = Math.max(1, Number(config.defaultTopK || 1));
        this.maxTopK = Math.max(this.defaultTopK, Number(config.maxTopK || this.defaultTopK));
        this.maxContextChars = Math.max(100, Number(config.maxContextChars || process.env.CHATBOT_MAX_CONTEXT_CHARS || 400));
        this.systemPrompt = config.systemPrompt || (`Responde únicamente con información presente en el CONTEXTO.
Si la respuesta no está claramente en el contexto, responde exactamente: "No tengo esa información en los documentos cargados".
No inventes datos, no uses conocimiento externo ni ejemplos de otros dominios.
Responde en Markdown, con frases claras y directas.`);
        
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
            ${this.systemPrompt}
            Contexto:
            {context}
            Pregunta: {question}
            Respuesta:`);
        
        console.log('RAGManager configurado correctamente');
        console.log(`Destino LLM: ${this.provider === 'ollama' ? config.ollamaBaseUrl : 'Groq Cloud'}`);
    }

    async buildPrompt(question, topK = this.defaultTopK) {
        if (this.vectorStore.documents.length === 0) {
            return { success: false, answer: 'No hay documentos cargados para responder.' };
        }

        const safeTopK = normalizeTopK(topK, this.maxTopK, this.defaultTopK);
        const maxContextChars = this.maxContextChars;
        const retrievalStart = nowMs();
        const scoredDocs = await this.vectorStore.similaritySearchWithScores(question, safeTopK);
        logTiming('Recuperación RAG', retrievalStart);

        // Evita pasar ruido al LLM: si la similitud es muy baja, no hay base confiable.
        const minScore = Number(process.env.RAG_MIN_SCORE || 0.02);
        const relevantDocs = scoredDocs.filter(({ score }) => Number(score) >= minScore);
        if (relevantDocs.length === 0) {
            return {
                success: false,
                answer: 'No tengo esa información en los documentos cargados.',
            };
        }

        let accumulated = '';
        for (const { doc, score } of relevantDocs) {
            const normalized = (doc.pageContent || '').replace(/\s+/g, ' ').trim();
            if (!normalized) continue;
            const remaining = maxContextChars - accumulated.length;
            if (remaining <= 0) break;
            const source = doc?.metadata?.source_pdf || doc?.metadata?.source || 'documento.pdf';
            const header = `Fuente: ${source} | score: ${Number(score).toFixed(4)}\n`;
            const budget = Math.max(0, remaining - header.length);
            if (budget <= 0) break;
            const piece = normalized.slice(0, budget);
            accumulated += `${accumulated ? '\n\n' : ''}${header}${piece}`;
        }
        const context = accumulated.slice(0, maxContextChars);
        if (!context.trim()) {
            return {
                success: false,
                answer: 'No tengo esa información en los documentos cargados.',
            };
        }
        const promptStart = nowMs();
        const finalPrompt = this.promptTemplate.template
            .replace('{context}', context)
            .replace('{question}', question);
        logTiming('Construcción de prompt', promptStart);
        console.log(`Contexto chars: ${context.length} | Prompt chars: ${finalPrompt.length} | topK: ${safeTopK}`);
        const contextPreview = context.slice(0, 240).replace(/\s+/g, ' ');
        console.log(`[RAG CONTEXT PREVIEW] ${contextPreview}`);

        return { success: true, finalPrompt, safeTopK };
    }

    async debugRetrieval(question, topK = this.defaultTopK) {
        if (this.vectorStore.documents.length === 0) {
            return {
                success: false,
                error: 'No hay documentos cargados para responder.',
                topK: 0,
                matches: [],
            };
        }

        const safeTopK = normalizeTopK(topK, this.maxTopK, this.defaultTopK);
        const retrieval = await this.vectorStore.similaritySearchWithScores(question, safeTopK);
        const matches = retrieval.map(({ doc, score }, index) => ({
            rank: index + 1,
            score: Number(score.toFixed(6)),
            snippet: String(doc.pageContent || '').replace(/\s+/g, ' ').trim().slice(0, 500),
            metadata: doc.metadata || {},
        }));

        return {
            success: true,
            topK: safeTopK,
            chunksLoaded: this.vectorStore.documents.length,
            matches,
        };
    }

    // Método para cargar PDFs desde memoria (Subidas desde Web/React)
    async loadPDFFromBuffer(pdfBuffer, filename = 'documento.pdf', extraMetadata = {}) {
        const uniqueToken = `${Date.now()}_${process.pid}_${Math.random().toString(36).slice(2, 10)}`;
        const tempPath = path.join(__dirname, `temp_${uniqueToken}.pdf`);
        await fs.writeFile(tempPath, pdfBuffer);
        try {
            const loader = new PDFLoader(tempPath);
            const docs = await loader.load();
            const splitDocsRaw = await this.textSplitter.splitDocuments(docs);
            const splitDocs = splitDocsRaw.map((doc, index) => ({
                ...doc,
                metadata: {
                    ...(doc.metadata || {}),
                    source_pdf: filename,
                    chunk_index: index,
                    ...extraMetadata,
                },
            }));
            await this.vectorStore.addDocuments(splitDocs);
            return { success: true, message: 'PDF cargado', chunks: splitDocs.length };
        } catch (error) {
            console.error('Error procesando buffer:', error.message);
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
            console.error(`Error cargando PDF desde ruta: ${pdfPath}`, error.message);
            throw error;
        }
    }

    async chat(question, topK = this.defaultTopK) {
        const totalStart = nowMs();
        try {
            const promptData = await this.buildPrompt(question, topK);
            if (!promptData.success) {
                return promptData;
            }

            let answer;
            if (this.provider === 'ollama') {
                answer = await this.llm.generate(promptData.finalPrompt);
            } else {
                const generationStart = nowMs();
                const chain = RunnableSequence.from([this.llm, new StringOutputParser()]);
                answer = await chain.invoke(promptData.finalPrompt);
                logTiming('Generación LLM total', generationStart);
            }

            logTiming('Chat total', totalStart);

            return { success: true, answer };
        } catch (error) {
            logTiming('Chat total con error', totalStart);
            console.error('Error en chat RAG:', error.message);
            return { success: false, error: error.message };
        }
    }

    async chatStream(question, topK = this.defaultTopK, onToken = async () => {}) {
        const totalStart = nowMs();
        try {
            const promptData = await this.buildPrompt(question, topK);
            if (!promptData.success) {
                return promptData;
            }

            let answer = '';
            if (this.provider === 'ollama' && typeof this.llm.generateStream === 'function') {
                answer = await this.llm.generateStream(promptData.finalPrompt, async (chunk) => {
                    answer += chunk;
                    await onToken(chunk);
                });
            } else {
                const fallback = await this.chat(question, topK);
                if (!fallback.success) {
                    return fallback;
                }
                answer = fallback.answer || '';
                if (answer) {
                    await onToken(answer);
                }
            }

            logTiming('Chat stream total', totalStart);
            return { success: true, answer };
        } catch (error) {
            logTiming('Chat stream total con error', totalStart);
            console.error('Error en chat RAG streaming:', error.message);
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