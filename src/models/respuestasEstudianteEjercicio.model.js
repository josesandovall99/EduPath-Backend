import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize.js";
import Estudiante from "./estudiante.model.js";

const RespuestaEstudianteEjercicio = sequelize.define(
  "RespuestaEstudianteEjercicio",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },

    respuesta: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    estudiante_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: Estudiante,
        key: "id",
      },
    },

    ejercicio_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },

    fecha_creacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    estado: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "respuestas_estudiante_ejercicio",
    timestamps: false,
  }
);

/* RELACIONES */
Estudiante.hasMany(RespuestaEstudianteEjercicio, {
  foreignKey: "estudiante_id",
});
RespuestaEstudianteEjercicio.belongsTo(Estudiante, {
  foreignKey: "estudiante_id",
});

export default RespuestaEstudianteEjercicio;
