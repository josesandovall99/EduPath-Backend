const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Persona = sequelize.define(
  "Persona",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },

    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    codigo_acceso: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    contraseña: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    tipo_usuario: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    fecha_registro: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "persona",
    timestamps: false,
  }
);

module.exports = Persona;
