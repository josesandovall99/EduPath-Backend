const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Persona = require("./persona.model");

const Administrador = sequelize.define(
  "Administrador",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      references: {
        model: Persona,
        key: "id",
      },
    },

    cargo: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    nivelAcceso: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "administrador",
    timestamps: false,
  }
);

/* HERENCIA 1 A 1 */
Persona.hasOne(Administrador, { foreignKey: "id" });
Administrador.belongsTo(Persona, { foreignKey: "id" });

module.exports = Administrador;
