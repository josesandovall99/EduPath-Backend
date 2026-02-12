const { ChatGroq } = require('@langchain/groq');
const { PDFLoader } = require('@langchain/community/document_loaders/fs/pdf');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { RunnableSequence } = require('@langchain/core/runnables');
const fs = require('fs').promises;
const path = require('path');

/**
 * Clase auxiliar para calcular embeddings simples con TF-IDF
 * No requiere dependencias externas problemáticas
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
            .filter(word => word.length > 2);
    }

    calculateTF(tokens) {
        const tf = {};
        const totalTokens = tokens.length;
        
        tokens.forEach(token => {
            tf[token] = (tf[token] || 0) + 1;
        });
        
        Object.keys(tf).forEach(token => {
            tf[token] = tf[token] / totalTokens;
        });
        
        return tf;
    }

    calculateIDF() {
        const docCount = this.documents.length;
        const documentFrequency = {};
        
        this.documents.forEach(doc => {
            const uniqueTokens = new Set(doc.tokens);
            uniqueTokens.forEach(token => {
                documentFrequency[token] = (documentFrequency[token] || 0) + 1;
            });
        });
        
        this.idfScores = {};
        Object.keys(documentFrequency).forEach(token => {
            this.idfScores[token] = Math.log(docCount / documentFrequency[token]);
        });
    }

    cosineSimilarity(query, doc) {
        const queryTokens = this.tokenize(query);
        const queryTF = this.calculateTF(queryTokens);
        
        let dotProduct = 0;
        let queryMagnitude = 0;
        let docMagnitude = 0;
        
        queryTokens.forEach(token => {
            const queryTFIDF = queryTF[token] * (this.idfScores[token] || 1);
            const docTFIDF = doc.tfidf[token] || 0;
            
            dotProduct += queryTFIDF * docTFIDF;
            queryMagnitude += queryTFIDF * queryTFIDF;
        });
        
        Object.values(doc.tfidf).forEach(value => {
            docMagnitude += value * value;
        });
        
        queryMagnitude = Math.sqrt(queryMagnitude);
        docMagnitude = Math.sqrt(docMagnitude);
        
        if (queryMagnitude === 0 || docMagnitude === 0) return 0;
        
        return dotProduct / (queryMagnitude * docMagnitude);
    }

    async addDocuments(docs) {
        for (const doc of docs) {
            const tokens = this.tokenize(doc.pageContent);
            const tf = this.calculateTF(tokens);
            
            this.documents.push({
                pageContent: doc.pageContent,
                metadata: doc.metadata,
                tokens: tokens,
                tf: tf,
                tfidf: {},
            });
        }
        
        this.calculateIDF();
        
        this.documents.forEach(doc => {
            doc.tokens.forEach(token => {
                doc.tfidf[token] = doc.tf[token] * (this.idfScores[token] || 0);
            });
        });
    }

    async similaritySearch(query, k = 4) {
        const similarities = this.documents.map((doc) => ({
            doc,
            score: this.cosineSimilarity(query, doc),
        }));
        
        return similarities
            .sort((a, b) => b.score - a.score)
            .slice(0, k)
            .map(item => item.doc);
    }
}

/**
 * RAGManager - Gestor de Retrieval-Augmented Generation
 * Usa Groq con Llama 3 para respuestas inteligentes basadas en documentos PDF
 */
class RAGManager {
    constructor(config = {}) {
        // Validar API Key de Groq
        if (!config.groqApiKey) {
            throw new Error('⚠️ GROQ_API_KEY es requerida. Obtén una en https://console.groq.com/');
        }

        // Configuración del LLM Groq
        this.llm = new ChatGroq({
            apiKey: config.groqApiKey,
            model: config.modelName || 'llama-3.3-70b-versatile',
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 2048,
            timeout: 30000,
            maxRetries: 3,
        });

        // Configuración del Text Splitter
        this.textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: config.chunkSize || 1000,
            chunkOverlap: config.chunkOverlap || 200,
            separators: ['\n\n', '\n', '. ', ' ', ''],
        });

        // Vector Store Simple (TF-IDF)
        this.vectorStore = null;

        // Configuración del prompt
        this.promptTemplate = PromptTemplate.fromTemplate(`
Eres un asistente educativo experto y amigable del sistema EduPath.

CONTEXTO RELEVANTE:
{context}

PREGUNTA DEL ESTUDIANTE: {question}

INSTRUCCIONES:
- Responde SOLO basándote en el contexto proporcionado
- Si la información no está en el contexto, di: "No tengo esa información en los documentos cargados"
- Sé claro, conciso y educativo
- Usa ejemplos cuando sea apropiado
- Estructura tu respuesta con bullet points si es necesario

RESPUESTA:`);

        console.log('✅ RAGManager inicializado correctamente');
        console.log(`   Modelo LLM: Groq ${config.modelName || 'llama-3.3-70b-versatile'}`);
        console.log(`   Búsqueda: TF-IDF + Cosine Similarity`);
        console.log(`   Chunk Size: ${config.chunkSize || 1000} caracteres`);
        console.log(`   Chunk Overlap: ${config.chunkOverlap || 200} caracteres`);
    }

    /**
     * Carga un PDF desde un buffer y lo indexa en el vector store
     */
    async loadPDFFromBuffer(pdfBuffer, filename = 'documento.pdf') {
        try {
            console.log(`\n📄 Procesando PDF: ${filename}...`);

            // Guardar buffer temporalmente
            const tempPath = path.join(__dirname, `temp_${Date.now()}.pdf`);
            await fs.writeFile(tempPath, pdfBuffer);

            try {
                // Cargar PDF
                const loader = new PDFLoader(tempPath);
                const docs = await loader.load();
                console.log(`   ✓ Páginas cargadas: ${docs.length}`);

                // Dividir en chunks
                const splitDocs = await this.textSplitter.splitDocuments(docs);
                console.log(`   ✓ Chunks creados: ${splitDocs.length}`);

                // Agregar metadata
                splitDocs.forEach((doc, idx) => {
                    doc.metadata = {
                        ...doc.metadata,
                        source: filename,
                        chunkIndex: idx,
                        totalChunks: splitDocs.length,
                    };
                });

                // Crear o actualizar Vector Store
                if (!this.vectorStore) {
                    console.log('   ⏳ Creando vector store con TF-IDF...');
                    this.vectorStore = new SimpleVectorStore();
                    await this.vectorStore.addDocuments(splitDocs);
                    console.log('   ✓ Vector store creado');
                } else {
                    console.log('   ⏳ Agregando documentos al vector store existente...');
                    await this.vectorStore.addDocuments(splitDocs);
                    console.log('   ✓ Documentos agregados');
                }

                return {
                    success: true,
                    message: 'PDF procesado exitosamente',
                    filename,
                    pagesLoaded: docs.length,
                    chunksCreated: splitDocs.length,
                };
            } finally {
                await fs.unlink(tempPath).catch(() => {});
            }
        } catch (error) {
            console.error('❌ Error cargando PDF:', error.message);
            throw new Error(`Error al cargar PDF: ${error.message}`);
        }
    }

    /**
     * Carga un PDF desde una ruta de archivo
     */
    async loadPDFFromPath(pdfPath) {
        try {
            const buffer = await fs.readFile(pdfPath);
            const filename = path.basename(pdfPath);
            return await this.loadPDFFromBuffer(buffer, filename);
        } catch (error) {
            throw new Error(`Error leyendo archivo: ${error.message}`);
        }
    }

    /**
     * Responde una pregunta usando RAG
     */
    async chat(question, topK = 3) {
        try {
            if (!this.vectorStore) {
                throw new Error('⚠️ No hay documentos cargados. Usa loadPDFFromBuffer() primero.');
            }

            if (!question || question.trim() === '') {
                throw new Error('⚠️ La pregunta no puede estar vacía.');
            }

            console.log(`\n💬 Pregunta recibida: "${question}"`);
            console.log(`   🔍 Buscando top ${topK} documentos relevantes...`);

            // Búsqueda de similitud
            const relevantDocs = await this.vectorStore.similaritySearch(question, topK);
            console.log(`   ✓ Documentos encontrados: ${relevantDocs.length}`);

            // Construir contexto
            const context = relevantDocs
                .map((doc, idx) => {
                    const pageInfo = doc.metadata.loc?.pageNumber 
                        ? ` (Página ${doc.metadata.loc.pageNumber})` 
                        : '';
                    return `[Fragmento ${idx + 1}]${pageInfo}:\n${doc.pageContent}`;
                })
                .join('\n\n---\n\n');

            // Crear cadena RAG
            const ragChain = RunnableSequence.from([
                {
                    context: () => context,
                    question: (input) => input.question,
                },
                this.promptTemplate,
                this.llm,
                new StringOutputParser(),
            ]);

            console.log('   ⏳ Generando respuesta con Groq...');

            // Ejecutar con manejo de errores robusto
            let response;
            let retries = 0;
            const maxRetries = 3;

            while (retries < maxRetries) {
                try {
                    response = await ragChain.invoke({ question });
                    break;
                } catch (error) {
                    retries++;
                    
                    if (error.message.includes('rate_limit_exceeded') || 
                        error.message.includes('429')) {
                        const waitTime = Math.pow(2, retries) * 1000;
                        console.warn(`   ⚠️ Rate limit alcanzado. Reintentando en ${waitTime/1000}s... (${retries}/${maxRetries})`);
                        
                        if (retries >= maxRetries) {
                            throw new Error(
                                '❌ Rate limit de Groq alcanzado. Por favor espera unos minutos e intenta nuevamente.\n' +
                                '💡 Consejo: Groq tiene límites gratuitos. Considera espaciar tus peticiones.'
                            );
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    } else if (error.message.includes('timeout')) {
                        throw new Error('❌ Timeout: La generación de respuesta tomó demasiado tiempo.');
                    } else {
                        throw error;
                    }
                }
            }

            console.log('   ✅ Respuesta generada exitosamente\n');

            return {
                success: true,
                question,
                answer: response,
                sourceDocuments: relevantDocs.map((doc, idx) => ({
                    chunkIndex: idx + 1,
                    content: doc.pageContent.substring(0, 200) + '...',
                    page: doc.metadata.loc?.pageNumber || 'N/A',
                    source: doc.metadata.source || 'Desconocido',
                })),
                metadata: {
                    documentsUsed: relevantDocs.length,
                    model: 'llama-3.3-70b-versatile (Groq)',
                    searchMethod: 'TF-IDF',
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            console.error('❌ Error en chat:', error.message);
            
            return {
                success: false,
                error: error.message,
                question,
                answer: null,
            };
        }
    }

    /**
     * Limpia el vector store
     */
    clear() {
        this.vectorStore = null;
        console.log('🗑️ Vector store limpiado');
    }

    /**
     * Obtiene estadísticas del vector store
     */
    getStats() {
        return {
            isLoaded: !!this.vectorStore,
            documentsCount: this.vectorStore ? this.vectorStore.documents.length : 0,
            message: this.vectorStore 
                ? `✅ ${this.vectorStore.documents.length} documentos cargados y listos` 
                : '⚠️ No hay documentos cargados',
        };
    }
}

module.exports = RAGManager;
