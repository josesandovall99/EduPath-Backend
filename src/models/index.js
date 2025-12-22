const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const Miniproyecto = require('./miniproyecto.model')(sequelize, DataTypes);

module.exports = {
  sequelize,
  Miniproyecto
};
