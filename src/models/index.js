const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// 1. Inicialización de Modelos en un objeto central
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

// 2. EJECUTAR ASOCIACIONES MODULARES
// Esto activa los métodos "associate" que pusiste en Actividad, Miniproyecto y Area
Object.keys(models).forEach((modelName) => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// =========================================================
// 3. ASOCIACIONES DE HERENCIA Y ESPECIALES (Se quedan en index)
// =========================================================

// --- HERENCIA: Actividad <-> Miniproyecto (1 a 1 por ID) ---
models.Actividad.hasOne(models.Miniproyecto, {
  foreignKey: 'id',
  as: 'detallesMiniproyecto'
});
models.Miniproyecto.belongsTo(models.Actividad, {
  foreignKey: 'id'
});

// --- HERENCIA: Actividad <-> Ejercicio (1 a 1) ---
models.Actividad.hasOne(models.Ejercicio, {
  foreignKey: 'id',
  as: 'detallesEjercicio'
});
models.Ejercicio.belongsTo(models.Actividad, {
  foreignKey: 'id',
  as: 'detallesEjercicio'   // alias igual en ambos lados
});



// Persona <-> Estudiante (1 a 1)
models.Persona.hasOne(models.Estudiante, {
  foreignKey: "persona_id",
  as: "estudiante",
});

models.Estudiante.belongsTo(models.Persona, {
  foreignKey: "persona_id",
  as: "persona",
});

// Persona <-> Administrador (1 a 1)
models.Persona.hasOne(models.Administrador, {
  foreignKey: "persona_id",
  as: "administrador",
});

models.Administrador.belongsTo(models.Persona, {
  foreignKey: "persona_id",
  as: "persona",
});


// --- Estructura Académica Restante (Si aún no las has movido a sus modelos) ---
models.Tema.belongsTo(models.Area, { foreignKey: 'area_id' });
models.Subtema.belongsTo(models.Tema, { foreignKey: 'tema_id' });
models.Ejercicio.belongsTo(models.Subtema, { foreignKey: 'subtema_id' });



module.exports = {
  sequelize,
  ...models // Exportamos todos los modelos listos para usar
};