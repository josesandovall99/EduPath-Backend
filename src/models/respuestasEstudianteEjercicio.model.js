const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Estudiante = require("./estudiante.model");

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

/* RELACIÓN */
Estudiante.hasMany(RespuestaEstudianteEjercicio, {
  foreignKey: "estudiante_id",
});
RespuestaEstudianteEjercicio.belongsTo(Estudiante, {
  foreignKey: "estudiante_id",
});

module.exports = RespuestaEstudianteEjercicio;
