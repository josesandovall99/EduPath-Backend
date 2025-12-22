const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const Miniproyecto = require('./miniproyecto.model')(sequelize, DataTypes);
const TipoActividad = require('./tipoactividad.model')(sequelize, DataTypes);
const actividad = require('./actividad.model')(sequelize, DataTypes);
const evaluacion = require('./evaluacion')(sequelize, DataTypes);
const progreso = require('./tipoactividad.model')(sequelize, DataTypes);


module.exports = {
  sequelize,
  Miniproyecto,
  TipoActividad,
  actividad,
  evaluacion,
  progreso
};
