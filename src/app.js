const express = require('express');
const app = express();
const sequelize = require('./config/database');
const db = require('./models');


app.use(express.json());

sequelize.authenticate()
    .then(() => console.log('Conectado a la base de datos ✅'))
    .catch(err => console.error('Error al conectar BD ❌', err));

db.sequelize.sync({ alter: false })
    .then(() => console.log('Modelos sincronizados 📦'))
    .catch(err => console.error('Error sincronizando ❌', err));

app.use('/miniproyectos', require('./routes/miniproyecto.routes'));
app.use('/evaluaciones', require('./routes/evaluacion.routes'));
app.use('/tipo-actividades', require('./routes/tipoactividad.routes'));
app.use('/actividades', require('./routes/actividad.routes'));
app.use('/progresos', require('./routes/progreso.routes'));

app.use('/areas', require('./routes/area.routes'));
app.use('/temas', require('./routes/tema.routes'));
app.use('/subtemas', require('./routes/subtema.routes'));
app.use('/contenidos', require('./routes/contenido.routes'));
app.use('/ejercicios', require('./routes/ejercicio.routes'));

app.use('/persona', require('./routes/persona.routes'));
app.use('/estudiante', require('./routes/estudiante.routes'));
app.use('/administrador', require('./routes/administrador.routes'));
app.use('/respuestasEstudianteEjercicio', require('./routes/respuestasEstudianteEjercicio.routes'));
app.use('/respuestasEstudianteMiniproyecto', require('./routes/respuestasEstudianteMiniproyecto.routes'));


app.listen(3000, () => {
    console.log('Servidor corriendo en el puerto 3000');
});
