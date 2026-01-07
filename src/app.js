require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const app = express();
const sequelize = require('./config/database');
const db = require('./models');

// --- CONFIGURACIÓN DE MIDDLEWARES ---
app.set('strict routing', false); 

// Habilita CORS para permitir peticiones desde tu frontend (Puerto 3000)
app.use(cors({ 
    origin: 'http://localhost:3000', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'], 
    allowedHeaders: ['Content-Type'] 
}));

app.use(express.json());

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
app.use('/ejercicios', require('./routes/ejercicio.routes'));
app.use('/persona', require('./routes/persona.routes'));
app.use('/estudiante', require('./routes/estudiante.routes'));
app.use('/administrador', require('./routes/administrador.routes'));

// 3. Progreso y Actividades
app.use('/miniproyectos', require('./routes/miniproyecto.routes'));
app.use('/evaluaciones', require('./routes/evaluacion.routes'));
app.use('/tipo-actividades', require('./routes/tipoactividad.routes'));
app.use('/actividades', require('./routes/actividad.routes'));
app.use('/progresos', require('./routes/progreso.routes'));
app.use('/respuestasEstudianteMiniproyecto', require('./routes/respuestasEstudianteMiniproyecto.routes'));

// 4. Diagramas (Añadido desde la versión remota)
app.use('/diagrams', require('./routes/diagram.routes'));

// --- RUTA DE MONITOREO ---
app.get('/debug', (req, res) => {
    res.json({ mensaje: "El servidor responde ✅", estado: "Online", puerto: 4000 });
});

// --- ARRANQUE DEL SERVIDOR ---
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});