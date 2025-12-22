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

app.use(
    '/miniproyectos',
    require('./routes/miniproyecto.routes')
);


app.listen(3000, () => {
    console.log('Servidor corriendo en el puerto 3000');
});
