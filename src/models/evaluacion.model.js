module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Evaluacion', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    calificacion: DataTypes.NUMERIC,
    retroalimentacion: DataTypes.TEXT,
    estudiante_id: DataTypes.BIGINT,
    ejercicio_id: DataTypes.BIGINT,
    miniproyecto_id: DataTypes.BIGINT,
    estado: DataTypes.TEXT,
    fecha_evaluacion: DataTypes.DATE
  }, {
    tableName: 'evaluacion',
    timestamps: false
  });
};
