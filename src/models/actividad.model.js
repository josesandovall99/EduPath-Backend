module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Actividad', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    titulo: DataTypes.TEXT,
    descripcion: DataTypes.TEXT,
    nivel_dificultad: DataTypes.TEXT,
    fecha_creacion: DataTypes.DATE,
    tipo_actividad_id: DataTypes.BIGINT
  }, {
    tableName: 'actividad',
    timestamps: false
  });
};
