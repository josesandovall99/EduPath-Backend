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

// Crea (o actualiza) las funciones SQL de performance en PostgreSQL.
// Se ejecuta en cada arranque con CREATE OR REPLACE — es idempotente y no toca datos.
async function inicializarFuncionesSQL() {
    const fnAsignatura = `
CREATE OR REPLACE FUNCTION calcular_progreso_asignatura(
  p_asignatura_id INTEGER,
  p_estudiante_id INTEGER,
  p_periodo       TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE sql STABLE AS $fn$
WITH
  asig AS (SELECT id, nombre FROM asignaturas WHERE id = p_asignatura_id AND estado = true LIMIT 1),
  est  AS (SELECT id, periodo_academico FROM estudiantes WHERE id = p_estudiante_id LIMIT 1),
  p_eff AS (SELECT COALESCE(p_periodo,(SELECT periodo_academico FROM est)) AS v),
  mini AS (
    SELECT
      COUNT(DISTINCT m.id)                                          AS total,
      COUNT(DISTINCT e1.id) FILTER (WHERE e1.estado='APROBADO')    AS aprobados,
      COUNT(DISTINCT e2.id) FILTER (WHERE e2.estado='REPROBADO')   AS desaprobados
    FROM miniproyecto m
    LEFT JOIN evaluacion e1 ON e1.miniproyecto_id=m.id AND e1.estudiante_id=p_estudiante_id AND e1.estado='APROBADO'   AND (p_periodo IS NULL OR e1.periodo_academico=p_periodo)
    LEFT JOIN evaluacion e2 ON e2.miniproyecto_id=m.id AND e2.estudiante_id=p_estudiante_id AND e2.estado='REPROBADO'  AND (p_periodo IS NULL OR e2.periodo_academico=p_periodo)
    WHERE m.asignatura_id=p_asignatura_id),
  t   AS (SELECT id,nombre,orden FROM temas WHERE asignatura_id=p_asignatura_id AND estado=true ORDER BY orden ASC,id ASC),
  ct  AS (SELECT c.id,c.tema_id FROM contenidos c WHERE c.tema_id IN (SELECT id FROM t) AND c.estado=true),
  st  AS (SELECT id,tema_id FROM subtemas WHERE tema_id IN (SELECT id FROM t) AND estado=true),
  seq AS (SELECT DISTINCT ct2.id,ct2.tema_id FROM ct ct2 WHERE EXISTS(SELECT 1 FROM secuencia_contenidos sc WHERE sc.estado=true AND (sc.contenido_origen_id=ct2.id OR sc.contenido_destino_id=ct2.id))),
  c_ej AS (SELECT c.id AS contenido_id,st2.tema_id FROM contenidos c JOIN st st2 ON c.subtema_id=st2.id WHERE c.estado=true),
  ej  AS (SELECT e.id AS ej_id,cj.tema_id FROM ejercicios e JOIN c_ej cj ON e.contenido_id=cj.contenido_id),
  prog_all AS (SELECT DISTINCT p.contenido_id,p.periodo_academico FROM progreso p WHERE p.estudiante_id=p_estudiante_id AND p.contenido_id IN (SELECT id FROM seq) AND p.completado=true AND p.estado='Visualizado'),
  prog_fil AS (SELECT DISTINCT contenido_id FROM prog_all WHERE p_periodo IS NULL OR periodo_academico=p_periodo),
  resp AS (SELECT r.ejercicio_id,r.estado FROM respuestas_estudiante_ejercicio r WHERE r.estudiante_id=p_estudiante_id AND r.ejercicio_id IN (SELECT ej_id FROM ej) AND r.estado IN ('ENVIADO','APROBADO') AND ((SELECT v FROM p_eff) IS NULL OR r.periodo_academico=(SELECT v FROM p_eff))),
  ts  AS (
    SELECT t2.id,t2.nombre,t2.orden,
      COUNT(DISTINCT s.id)                                                       AS total_contenidos,
      COUNT(DISTINCT pf.contenido_id)                                            AS cont_vistos,
      COUNT(DISTINCT e2.ej_id)                                                   AS total_ejercicios,
      COUNT(DISTINCT r2.ejercicio_id) FILTER (WHERE r2.estado='APROBADO')       AS ej_aprobados,
      COUNT(DISTINCT r2.ejercicio_id)                                            AS ej_completados
    FROM t t2
    LEFT JOIN seq      s  ON s.tema_id      =t2.id
    LEFT JOIN prog_fil pf ON pf.contenido_id=s.id
    LEFT JOIN ej       e2 ON e2.tema_id     =t2.id
    LEFT JOIN resp     r2 ON r2.ejercicio_id=e2.ej_id
    GROUP BY t2.id,t2.nombre,t2.orden ORDER BY t2.orden ASC,t2.id ASC),
  glob AS (SELECT COALESCE(SUM(total_contenidos),0) AS tc,COALESCE(SUM(cont_vistos),0) AS cv,COALESCE(SUM(total_ejercicios),0) AS te,COALESCE(SUM(ej_completados),0) AS ec FROM ts)
SELECT jsonb_build_object(
  '_asignatura_found',(SELECT id FROM asig) IS NOT NULL,
  '_estudiante_found',(SELECT id FROM est)  IS NOT NULL,
  'Asignatura',(SELECT jsonb_build_object('id',id,'nombre',nombre) FROM asig),
  'estudiante_id',p_estudiante_id,
  'miniproyectos',(SELECT jsonb_build_object('total',total,'aprobados',aprobados,'desaprobados',desaprobados) FROM mini),
  'temas',jsonb_build_object(
    'total',(SELECT COUNT(*) FROM t),
    'completados',(SELECT COUNT(*) FROM ts WHERE (total_contenidos+total_ejercicios)>0 AND (cont_vistos+ej_aprobados)=(total_contenidos+total_ejercicios)),
    'pendientes',(SELECT COUNT(*) FROM ts WHERE NOT((total_contenidos+total_ejercicios)>0 AND (cont_vistos+ej_aprobados)=(total_contenidos+total_ejercicios))),
    'siguiente',(SELECT nombre FROM ts WHERE NOT((total_contenidos+total_ejercicios)>0 AND (cont_vistos+ej_aprobados)=(total_contenidos+total_ejercicios)) ORDER BY orden ASC,id ASC LIMIT 1),
    'detalle',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'nombre',nombre,'totalContenidos',total_contenidos,'contenidosVistos',cont_vistos,'totalEjercicios',total_ejercicios,'ejerciciosAprobados',ej_aprobados,'completado',(total_contenidos+total_ejercicios)>0 AND (cont_vistos+ej_aprobados)=(total_contenidos+total_ejercicios)) ORDER BY orden ASC,id ASC) FROM ts),'[]'::jsonb)),
  'progreso',(SELECT CASE WHEN tc>0 AND te>0 THEN jsonb_build_object('contenidos',jsonb_build_object('total',tc,'completados',cv,'porcentaje',ROUND((cv*100.0/tc)::numeric)),'ejercicios',jsonb_build_object('total',te,'completados',ec,'porcentaje',ROUND((ec*100.0/te)::numeric))) WHEN tc>0 THEN jsonb_build_object('contenidos',jsonb_build_object('total',tc,'completados',cv,'porcentaje',ROUND((cv*100.0/tc)::numeric))) WHEN te>0 THEN jsonb_build_object('ejercicios',jsonb_build_object('total',te,'completados',ec,'porcentaje',ROUND((ec*100.0/te)::numeric))) ELSE '{}'::jsonb END FROM glob),
  'resumen',(SELECT jsonb_build_object('totalItems',tc+te,'itemsCompletados',cv+ec,'porcentajeTotalAsignatura',CASE WHEN (tc+te)>0 THEN ROUND(((cv+ec)*100.0/(tc+te))::numeric) ELSE 0 END,'estado',CASE WHEN (tc+te)=0 THEN 'Iniciado' WHEN (cv+ec)=(tc+te) THEN 'Completado' WHEN (cv+ec)>=(tc+te)/2.0 THEN 'En progreso' ELSE 'Iniciado' END) FROM glob),
  'periodos_activos',COALESCE((SELECT jsonb_agg(DISTINCT periodo_academico ORDER BY periodo_academico) FROM prog_all WHERE periodo_academico IS NOT NULL),'[]'::jsonb));
$fn$;`;

    const fnSubtema = `
CREATE OR REPLACE FUNCTION calcular_progreso_subtemas_bulk(
  p_subtema_ids   INTEGER[],
  p_estudiante_id INTEGER
)
RETURNS JSONB LANGUAGE sql STABLE AS $fn$
WITH
  subs AS (SELECT id FROM subtemas WHERE id=ANY(p_subtema_ids) AND estado=true),
  cs   AS (SELECT c.id AS contenido_id,c.subtema_id FROM contenidos c WHERE c.subtema_id=ANY(p_subtema_ids) AND c.estado=true),
  seq  AS (SELECT DISTINCT cs2.contenido_id,cs2.subtema_id FROM cs cs2 WHERE EXISTS(SELECT 1 FROM secuencia_contenidos sc WHERE sc.estado=true AND (sc.contenido_origen_id=cs2.contenido_id OR sc.contenido_destino_id=cs2.contenido_id))),
  prog AS (SELECT DISTINCT p.contenido_id FROM progreso p JOIN seq s ON p.contenido_id=s.contenido_id WHERE p.estudiante_id=p_estudiante_id AND p.completado=true AND p.estado='Visualizado'),
  stats AS (
    SELECT s.id,COUNT(DISTINCT seq2.contenido_id) AS total,COUNT(DISTINCT pr.contenido_id) AS vistos
    FROM subs s
    LEFT JOIN seq  seq2 ON seq2.subtema_id   =s.id
    LEFT JOIN prog pr   ON pr.contenido_id   =seq2.contenido_id
    GROUP BY s.id)
SELECT COALESCE(jsonb_object_agg(id::text,jsonb_build_object('resumen',jsonb_build_object('totalItems',total,'itemsCompletados',vistos,'porcentajeTotalSubtema',CASE WHEN total>0 THEN ROUND((vistos*100.0/total)::numeric) ELSE 0 END,'estado',CASE WHEN total=0 THEN 'Iniciado' WHEN vistos=total THEN 'Completado' WHEN vistos>=total/2.0 THEN 'En progreso' ELSE 'Iniciado' END))),'{}') FROM stats;
$fn$;`;

    try {
        await db.sequelize.query(fnAsignatura);
        await db.sequelize.query(fnSubtema);
        console.log('Funciones SQL de performance inicializadas');
    } catch (err) {
        console.error('Error al inicializar funciones SQL:', err.message);
    }
}

db.sequelize.sync(syncOptions)
    .then(async () => {
        console.log('Base de datos sincronizada con exito');

        await inicializarFuncionesSQL();

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