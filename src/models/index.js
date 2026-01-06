const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// 1. Inicialización de Modelos
const models = {
  Miniproyecto: require('./miniproyecto.model')(sequelize, DataTypes),
  TipoActividad: require('./tipoactividad.model')(sequelize, DataTypes),
  Actividad: require('./actividad.model')(sequelize, DataTypes),
  Evaluacion: require('./evaluacion.model')(sequelize, DataTypes),
  Progreso: require('./progreso.model')(sequelize, DataTypes),
  Persona: require('./persona.model')(sequelize, DataTypes),
  Estudiante: require('./estudiante.model')(sequelize, DataTypes),
  Administrador: require('./administrador.model')(sequelize, DataTypes),
  RespuestaEstudianteMiniproyecto: require('./respuestasEstudianteMiniproyecto.model')(sequelize, DataTypes),
  RespuestaEstudianteEjercicio: require('./respuestasEstudianteEjercicio.model')(sequelize, DataTypes),
  Area: require('./area.model')(sequelize, DataTypes),
  Tema: require('./tema.models')(sequelize, DataTypes),
  Subtema: require('./subtema.models')(sequelize, DataTypes),
  Contenido: require('./contenido.models')(sequelize, DataTypes),
  Ejercicio: require('./ejercicio.models')(sequelize, DataTypes)
};

// 2. Ejecutar asociaciones modulares (definidas dentro de cada archivo .model)
Object.keys(models).forEach((modelName) => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// =========================================================
// 3. ASOCIACIONES MANUALES Y DE HERENCIA
// =========================================================

// --- HERENCIA: Actividad <-> Miniproyecto ---
models.Actividad.hasOne(models.Miniproyecto, { foreignKey: 'id', as: 'detallesMiniproyecto' });
models.Miniproyecto.belongsTo(models.Actividad, { foreignKey: 'id' });

// --- HERENCIA: Actividad <-> Ejercicio ---
models.Actividad.hasOne(models.Ejercicio, { foreignKey: 'id', as: 'detallesEjercicio' });
models.Ejercicio.belongsTo(models.Actividad, { foreignKey: 'id' });

// --- USUARIOS: Persona <-> Estudiante / Administrador ---
models.Persona.hasOne(models.Estudiante, { foreignKey: "persona_id", as: "estudiante" });
models.Estudiante.belongsTo(models.Persona, { foreignKey: "persona_id", as: "persona" });

models.Persona.hasOne(models.Administrador, { foreignKey: "persona_id", as: "administrador" });
models.Administrador.belongsTo(models.Persona, { foreignKey: "persona_id", as: "persona" });

// --- ESTRUCTURA ACADÉMICA ---
models.Tema.belongsTo(models.Area, { foreignKey: 'area_id', as: 'area' });
models.Subtema.belongsTo(models.Tema, { foreignKey: 'tema_id', as: 'tema' });
models.Ejercicio.belongsTo(models.Subtema, { foreignKey: 'subtema_id', as: 'subtema' });

// =========================================================
// 4. ASOCIACIONES PARA RESPUESTAS (NUEVO)
// =========================================================

// RespuestaEjercicio <-> Estudiante
models.Estudiante.hasMany(models.RespuestaEstudianteEjercicio, { foreignKey: 'estudiante_id', as: 'respuestasEjercicio' });
models.RespuestaEstudianteEjercicio.belongsTo(models.Estudiante, { foreignKey: 'estudiante_id', as: 'estudiante' });

// RespuestaEjercicio <-> Ejercicio
models.Ejercicio.hasMany(models.RespuestaEstudianteEjercicio, { foreignKey: 'ejercicio_id', as: 'respuestas' });
models.RespuestaEstudianteEjercicio.belongsTo(models.Ejercicio, { foreignKey: 'ejercicio_id', as: 'ejercicio' });

module.exports = {
  sequelize,
  ...models
};