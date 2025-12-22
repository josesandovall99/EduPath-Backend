module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Progreso', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    estudiante_id: DataTypes.BIGINT,
    ejercicio_id: DataTypes.BIGINT,
    miniproyecto_id: DataTypes.BIGINT,
    completado: DataTypes.BOOLEAN,
    estado: DataTypes.TEXT,
    fecha_inicio: DataTypes.DATE,
    fecha_fin: DataTypes.DATE
  }, {
    tableName: 'progreso',
    timestamps: false
  });
};
