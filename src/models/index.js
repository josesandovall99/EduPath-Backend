const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const Miniproyecto = require('./miniproyecto.model')(sequelize, DataTypes);
const TipoActividad = require('./tipoactividad.model')(sequelize, DataTypes);
const actividad = require('./actividad.model')(sequelize, DataTypes);
const evaluacion = require('./evaluacion.model')(sequelize, DataTypes);
const progreso = require('./progreso.model')(sequelize, DataTypes);
const Persona = require('./persona.model')(sequelize, DataTypes);
const Estudiante = require('./estudiante.model')(sequelize, DataTypes);
const Administrador = require('./administrador.model')(sequelize, DataTypes);
const RespuestaEstudianteMiniproyecto = require('./respuestasEstudianteMiniproyecto.model')(sequelize, DataTypes);
const RespuestaEstudianteEjercicio = require('./respuestasEstudianteEjercicio.model')(sequelize, DataTypes);



const Area = require('./area.model')(sequelize, DataTypes);
const Tema = require('./tema.models')(sequelize, DataTypes);
const Subtema = require('./subtema.models')(sequelize, DataTypes);
const Contenido = require('./contenido.models')(sequelize, DataTypes);
const Ejercicio = require('./ejercicio.models')(sequelize, DataTypes);


module.exports = {
  sequelize,
  Miniproyecto,
  TipoActividad,
  actividad,
  evaluacion,
  progreso,
  Persona,
  Estudiante,
  Administrador,
  RespuestaEstudianteMiniproyecto,
  RespuestaEstudianteEjercicio,
  Area,
  Tema,
  Subtema,
  Contenido,
  Ejercicio
};
