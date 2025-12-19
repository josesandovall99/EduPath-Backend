import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";
import Persona from "./persona.model.js";

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

    nivel_acceso: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "administrador",
    timestamps: false,
  }
);

/* RELACIÓN 1 A 1 (HERENCIA) */
Persona.hasOne(Administrador, { foreignKey: "id" });
Administrador.belongsTo(Persona, { foreignKey: "id" });

export default Administrador;
