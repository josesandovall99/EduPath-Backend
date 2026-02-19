require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const app = express();
const sequelize = require('./config/database');
const db = require('./models');
const { initializeRAG } = require('./controllers/chatbot.controller');

// --- CONFIGURACIÓN DE MIDDLEWARES ---
app.set('strict routing', false); 

// Habilita CORS para permitir peticiones desde tu frontend (Puerto 3000)
app.use(cors({ 
    origin: 'http://localhost:3000', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
    allowedHeaders: ['Content-Type', 'x-persona-id', 'x-docente-id', 'x-tipo-usuario'],
    credentials: true
}));

// Cambie esto: app.use(express.json());

//Por esto:
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))


// Logger para confirmar qué llega al servidor
app.use((req, res, next) => {
    console.log(`Mensaje del Servidor: Recibido ${req.method} en ${req.url}`);
    next();
});

// --- RUTAS DEL SISTEMA ---

// 1. Ruta del Compilador (Prioridad)
const respuestasEjercicioRouter = require('./routes/respuestasEstudianteEjercicio.routes');
app.use('/respuestasEstudianteEjercicio', respuestasEjercicioRouter);
console.log('✅ Ruta /respuestasEstudianteEjercicio registrada');

// 2. Rutas Académicas y Usuarios
app.use('/areas', require('./routes/area.routes'));
app.use('/temas', require('./routes/tema.routes'));
app.use('/subtemas', require('./routes/subtema.routes'));
app.use('/contenidos', require('./routes/contenido.routes'));
const secuenciaSubtemaRoutes = require('./routes/secuenciaSubtema.routes');
app.use('/secuencias-subtema', secuenciaSubtemaRoutes);
app.use('/secuencias-contenido', require('./routes/secuenciaContenido.routes'));
app.use('/ejercicios', require('./routes/ejercicio.routes'));
app.use('/persona', require('./routes/persona.routes'));
app.use('/estudiante', require('./routes/estudiante.routes'));
app.use('/administrador', require('./routes/administrador.routes'));
app.use('/docente', require('./routes/docente.routes'));

// 3. Progreso y Actividades
app.use('/miniproyectos', require('./routes/miniproyecto.routes'));
app.use('/evaluaciones', require('./routes/evaluacion.routes'));
// Tipo de Actividad: ruta principal y alias compatible con el frontend
app.use('/tipo-actividades', require('./routes/tipoactividad.routes'));
app.use('/tipoactividad', require('./routes/tipoactividad.routes'));
app.use('/actividades', require('./routes/actividad.routes'));
app.use('/progresos', require('./routes/progreso.routes'));
app.use('/respuestasEstudianteMiniproyecto', require('./routes/respuestasEstudianteMiniproyecto.routes'));

// 4. Diagramas (Añadido desde la versión remota)
app.use('/diagrams', require('./routes/diagram.routes'));

// 5. Chatbot RAG con Groq
app.use('/chatbot', require('./routes/chatbot.routes'));

// --- RUTA DE MONITOREO ---
app.get('/debug', (req, res) => {
    res.json({ mensaje: "El servidor responde ✅", estado: "Online", puerto: 4000 });
});

// --- ARRANQUE DEL SERVIDOR CON SINCRONIZACIÓN ---
const PORT = process.env.PORT || 4000;

// Sincronizamos con la base de datos antes de iniciar el servidor
// .sync({ alter: true }) creará las tablas automáticamente en la nueva BD de Render
db.sequelize.sync({ alter: true })
    .then(async () => {
        console.log('✅ Base de datos sincronizada con éxito en Render');
        
        // Inicializar Chatbot RAG
        await initializeRAG();
        
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ No se pudo conectar a la base de datos de Render:', err.message);
        console.log('Asegúrate de haber añadido tu IP en "Access Control" dentro del dashboard de Render.');
    });