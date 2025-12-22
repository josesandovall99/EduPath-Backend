const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const Miniproyecto = require('./miniproyecto.model')(sequelize, DataTypes);
const Area = require('./area.model')(sequelize, DataTypes);

module.exports = {
  sequelize,
  Miniproyecto,
  Area
};
