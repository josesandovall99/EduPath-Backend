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
    timestamps: false,
    indexes: [
      // Lookup por estudiante — patrón más frecuente en todos los endpoints de progreso
      { fields: ['estudiante_id'], name: 'idx_progreso_estudiante_id' },
      // Lookup por contenido — usado en marcarContenidoVisualizado
      { fields: ['contenido_id'], name: 'idx_progreso_contenido_id' },
      // Compuesto para verificar si un estudiante completó un contenido específico
      { fields: ['estudiante_id', 'contenido_id', 'completado'], name: 'idx_progreso_est_cont_completado' },
    ]
  });

  Progreso.associate = models => {
    Progreso.belongsTo(models.Contenido, { foreignKey: 'contenido_id', as: 'contenido' });
  };

  return Progreso;
};
