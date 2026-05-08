require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const app = express();
const sequelize = require('./config/database');
const db = require('./models');

// --- CONFIGURACIÓN DE MIDDLEWARES ---
app.set('strict routing', false); 
app.disable('x-powered-by');

// CORS: permite entornos locales y despliegues de Render configurables por variable.
const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = new Set([
    'https://edupath-frontend-dwcf.onrender.com',
    'http://edupath-app.me',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:4173',  // vite preview
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:4173',  // vite preview
    'http://127.0.0.1:5173',
    // Red local (LAN)
    'http://192.168.3.21',
    'http://192.168.3.21:3000',
    'http://192.168.3.21:4173',  // vite preview LAN
    'http://192.168.3.21:5173',
    ...configuredOrigins,
]);

const corsOptions = {
    origin: (origin, callback) => {
        // Permite clientes sin origin (curl/postman/health checks internos).
        if (!origin) return callback(null, true);

        const isRenderFrontend = /^https:\/\/edupath-frontend-[a-z0-9-]+\.onrender\.com$/i.test(origin);
        const isAllowed = allowedOrigins.has(origin) || isRenderFrontend;

        if (isAllowed) return callback(null, true);
        return callback(new Error(`CORS bloqueado para origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-docente-id', 'x-tipo-usuario', 'x-asignatura-id', 'x-persona-id', 'x-admin-id' , 'x-administrador-id'],
    credentials: true,
};

app.use(cors(corsOptions));

// Gzip: reduce el tamaño de las respuestas JSON un 70-85%.
// Debe ir antes de cualquier ruta para comprimir todos los payloads.
app.use(compression({ level: 6 }));

app.use((req, res, next) => {
    // Baseline OWASP-recommended security headers for API responses.
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");

    // Los GETs de listados se pueden cachear 30 s en el cliente (reducen re-fetches).
    // POSTs, PUTs, DELETEs nunca deben cachearse.
    if (req.method === 'GET') {
        res.set('Cache-Control', 'private, max-age=30');
    } else {
        res.set('Cache-Control', 'no-store');
    }
    next();
});

// 50mb era innecesario para una API de contenido educativo y permitía ataques
// de payload gigante. Se limita a 5mb (suficiente para PDFs de chatbot base64).
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));


// Logger eliminado en producción: console.log por cada request bloquea el
// event loop de Node.js y añade latencia visible (~5-15 ms/req en I/O lento).
// Para debug local, descomenta temporalmente:
// app.use((req, res, next) => { console.log(`${req.method} ${req.url}`); next(); });

// --- RUTAS DEL SISTEMA ---

// 1. Ruta del Compilador (Prioridad)
const respuestasEjercicioRouter = require('./routes/respuestasEstudianteEjercicio.routes');
app.use('/respuestasEstudianteEjercicio', respuestasEjercicioRouter);
console.log('Ruta /respuestasEstudianteEjercicio registrada');

// 2. Rutas Académicas y Usuarios
app.use('/asignaturas', require('./routes/asignatura.routes'));
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

// 5. Chatbot RAG gestionado por chatbotId (único flujo permitido)
app.use('/chatbots', require('./routes/chatbots.routes'));

// --- RUTA DE MONITOREO ---
app.get('/debug', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ mensaje: 'No encontrado' });
    }
    res.json({ mensaje: 'El servidor responde', estado: 'Online', puerto: 4000 });
});

// --- ARRANQUE DEL SERVIDOR CON SINCRONIZACIÓN ---
const PORT = process.env.PORT || 4000;

// En desarrollo se usa { alter: true } para que Sequelize ajuste las columnas
// automáticamente. En producción/LAN se usa { force: false } (solo crea tablas
// que no existen) para evitar la inspección de esquema que añade 3-8 s al arranque.
const syncOptions = process.env.NODE_ENV === 'development'
    ? { alter: true }
    : { force: false };

db.sequelize.sync(syncOptions)
    .then(async () => {
        console.log('Base de datos sincronizada con exito');
        
        console.log('RAG legacy global deshabilitado. Se usa únicamente /chatbots/:id');
        
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('No se pudo conectar a la base de datos:', err.message);
        if (err.code === 'ENOTFOUND') {
            console.log('El host configurado no se pudo resolver desde tu PC. Si usas Supabase localmente, prefiere DATABASE_URL con el pooler IPv4 del proyecto.');
        } else if (err.code === 'ECONNREFUSED') {
            console.log('El host resolvio, pero rechazo la conexion. Verifica puerto, SSL y acceso externo.');
        } else if (err.code === '28P01') {
            console.log('Las credenciales de PostgreSQL son invalidas. Revisa usuario y contrasena.');
        } else {
            console.log('Revisa DATABASE_URL o las variables DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD y DB_SSL.');
        }
    });