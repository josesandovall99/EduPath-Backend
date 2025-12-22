module.exports = (sequelize, DataTypes) => {
  const RespuestasEstudianteEjercicio = sequelize.define(
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
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      ejercicio_id: {
        type: DataTypes.INTEGER,
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

  return RespuestasEstudianteEjercicio;
};
