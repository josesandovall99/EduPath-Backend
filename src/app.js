require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const app = express();
const sequelize = require('./config/database');
const db = require('./models');

<<<<<<< HEAD
app.set('strict routing', false); 
app.use(cors()); 
=======
// 👇 habilita CORS para permitir peticiones desde tu frontend
app.use(cors({ origin: 'http://localhost:3000', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type'] }));

>>>>>>> acb13d8ffa074311a067b84f212f3515af602c1b
app.use(express.json());

// Logger para confirmar qué llega al servidor
app.use((req, res, next) => {
    console.log(`Mensaje del Servidor: Recibido ${req.method} en ${req.url}`);
    next();
});

// --- RUTAS DEL SISTEMA (MANTENIENDO TUS RUTAS ORIGINALES) ---

// 1. Cargamos la ruta que te da error 404 primero para darle prioridad
const respuestasEjercicioRouter = require('./routes/respuestasEstudianteEjercicio.routes');
app.use('/respuestasEstudianteEjercicio', respuestasEjercicioRouter);
console.log('✅ Ruta /respuestasEstudianteEjercicio registrada');

// 2. El resto de tus rutas (Sin cambios)
app.use('/areas', require('./routes/area.routes'));
app.use('/temas', require('./routes/tema.routes'));
app.use('/subtemas', require('./routes/subtema.routes'));
app.use('/contenidos', require('./routes/contenido.routes'));
app.use('/ejercicios', require('./routes/ejercicio.routes'));
app.use('/persona', require('./routes/persona.routes'));
app.use('/estudiante', require('./routes/estudiante.routes'));
app.use('/administrador', require('./routes/administrador.routes'));
app.use('/miniproyectos', require('./routes/miniproyecto.routes'));
app.use('/evaluaciones', require('./routes/evaluacion.routes'));
app.use('/tipo-actividades', require('./routes/tipoactividad.routes'));
app.use('/actividades', require('./routes/actividad.routes'));
app.use('/progresos', require('./routes/progreso.routes'));
app.use('/respuestasEstudianteMiniproyecto', require('./routes/respuestasEstudianteMiniproyecto.routes'));

<<<<<<< HEAD
app.get('/debug', (req, res) => {
    res.json({ mensaje: "El servidor responde ✅", estado: "Online" });
=======

//DIAGRAMAS
app.use('/diagrams', require('./routes/diagram.routes'));


app.listen(4000, () => {
    console.log('Servidor corriendo en el puerto 4000');
>>>>>>> acb13d8ffa074311a067b84f212f3515af602c1b
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor en puerto ${PORT}`);
});