require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const app = express();

app.set('strict routing', false);
app.disable('x-powered-by');

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
  'http://localhost:4173',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173',
  'http://192.168.3.21',
  'http://192.168.3.21:3000',
  'http://192.168.3.21:4173',
  'http://192.168.3.21:5173',
  ...configuredOrigins,
]);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const isRenderFrontend = /^https:\/\/edupath-frontend-[a-z0-9-]+\.onrender\.com$/i.test(origin);
    const isAllowed = allowedOrigins.has(origin) || isRenderFrontend;

    if (isAllowed) return callback(null, true);
    return callback(new Error(`CORS bloqueado para origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-docente-id', 'x-tipo-usuario', 'x-asignatura-id', 'x-persona-id', 'x-admin-id', 'x-administrador-id'],
  credentials: true,
};

app.use(cors(corsOptions));

app.use(compression({ level: 6 }));

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");

  if (req.method === 'GET') {
    res.set('Cache-Control', 'private, max-age=30');
  } else {
    res.set('Cache-Control', 'no-store');
  }
  next();
});

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

const respuestasEjercicioRouter = require('./routes/respuestasEstudianteEjercicio.routes');
app.use('/respuestasEstudianteEjercicio', respuestasEjercicioRouter);
console.log('Ruta /respuestasEstudianteEjercicio registrada');

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

app.use('/miniproyectos', require('./routes/miniproyecto.routes'));
app.use('/evaluaciones', require('./routes/evaluacion.routes'));
app.use('/tipo-actividades', require('./routes/tipoactividad.routes'));
app.use('/tipoactividad', require('./routes/tipoactividad.routes'));
app.use('/actividades', require('./routes/actividad.routes'));
app.use('/progresos', require('./routes/progreso.routes'));
app.use('/respuestasEstudianteMiniproyecto', require('./routes/respuestasEstudianteMiniproyecto.routes'));

app.use('/diagrams', require('./routes/diagram.routes'));

app.use('/chatbots', require('./routes/chatbots.routes'));

app.get('/debug', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ mensaje: 'No encontrado' });
  }
  res.json({ mensaje: 'El servidor responde', estado: 'Online', puerto: 4000 });
});

module.exports = app;
