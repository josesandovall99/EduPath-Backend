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



const area = require('./area.model')(sequelize, DataTypes);


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
  area
};
