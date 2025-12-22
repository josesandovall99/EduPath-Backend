const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Estudiante = require("./estudiante.model");

const RespuestaEstudianteMiniproyecto = sequelize.define(
  "RespuestaEstudianteMiniproyecto",
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

    miniproyecto_id: {
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
    tableName: "respuestas_estudiante_miniproyecto",
    timestamps: false,
  }
);

/* RELACIÓN */
Estudiante.hasMany(RespuestaEstudianteMiniproyecto, {
  foreignKey: "estudiante_id",
});
RespuestaEstudianteMiniproyecto.belongsTo(Estudiante, {
  foreignKey: "estudiante_id",
});

module.exports = RespuestaEstudianteMiniproyecto;
