module.exports = (sequelize, DataTypes) => {
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
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      miniproyecto_id: {
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

      contador: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "respuestas_estudiante_miniproyecto",
      timestamps: false,
    }
  );

  return RespuestaEstudianteMiniproyecto;
};
