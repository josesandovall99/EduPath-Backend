module.exports = (sequelize, DataTypes) => {
  const Progreso = sequelize.define('Progreso', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    estudiante_id: DataTypes.BIGINT,
    ejercicio_id: DataTypes.BIGINT,
    miniproyecto_id: DataTypes.BIGINT,
    contenido_id: DataTypes.BIGINT,
    completado: DataTypes.BOOLEAN,
    estado: DataTypes.TEXT,
    fecha_inicio: DataTypes.DATE,
    fecha_fin: DataTypes.DATE
  }, {
    tableName: 'progreso',
    timestamps: false
  });

  Progreso.associate = models => {
    Progreso.belongsTo(models.Contenido, { foreignKey: 'contenido_id', as: 'contenido' });
  };

  return Progreso;
};
