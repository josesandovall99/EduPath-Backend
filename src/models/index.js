const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// Inicialización de Modelos
const Miniproyecto = require('./miniproyecto.model')(sequelize, DataTypes);
const TipoActividad = require('./tipoactividad.model')(sequelize, DataTypes);
const Actividad = require('./actividad.model')(sequelize, DataTypes);
const Evaluacion = require('./evaluacion.model')(sequelize, DataTypes);
const Progreso = require('./progreso.model')(sequelize, DataTypes);
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

// =======================
// ASOCIACIONES
// =======================

// --- RELACIÓN: Actividad <-> TipoActividad (N a 1) ---
Actividad.belongsTo(TipoActividad, {
  foreignKey: 'tipo_actividad_id',
  as: 'tipo'
});
TipoActividad.hasMany(Actividad, {
  foreignKey: 'tipo_actividad_id'
});

// --- HERENCIA: Actividad <-> Miniproyecto (1 a 1) ---
Actividad.hasOne(Miniproyecto, {
  foreignKey: 'id',
  as: 'detallesMiniproyecto'
});
Miniproyecto.belongsTo(Actividad, {
  foreignKey: 'id'
});

// --- HERENCIA: Actividad <-> Ejercicio (1 a 1) ---
Actividad.hasOne(Ejercicio, {
  foreignKey: 'id',
  as: 'detallesEjercicio'
});
Ejercicio.belongsTo(Actividad, {
  foreignKey: 'id'
});

// --- Persona <-> Estudiante (1 a 1) ---
Persona.hasOne(Estudiante, {
  foreignKey: "id",
  as: "perfilEstudiante",
});
Estudiante.belongsTo(Persona, {
  foreignKey: "id",
});

// --- Persona <-> Administrador (1 a 1) ---
Persona.hasOne(Administrador, {
  foreignKey: "id",
  as: "perfilAdmin",
});
Administrador.belongsTo(Persona, {
  foreignKey: "id",
});

// --- Estructura Académica ---
Area.hasMany(Tema, { foreignKey: 'area_id' });
Tema.belongsTo(Area, { foreignKey: 'area_id' });

Tema.hasMany(Subtema, { foreignKey: 'tema_id' });
Subtema.belongsTo(Tema, { foreignKey: 'tema_id' });



module.exports = {
  sequelize,
  Miniproyecto,
  TipoActividad,
  Actividad,
  Evaluacion,
  Progreso,
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