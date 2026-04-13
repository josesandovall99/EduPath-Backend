module.exports = (sequelize, DataTypes) => {
  const Actividad = sequelize.define('Actividad', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    titulo: {
      type: DataTypes.TEXT
    },
    descripcion: {
      type: DataTypes.TEXT
    },
    nivel_dificultad: {
      type: DataTypes.TEXT
    },
    fecha_creacion: {
      type: DataTypes.DATE
    },
    estado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    tipo_actividad_id: {
      type: DataTypes.BIGINT,
      allowNull: false // Recomendado para validar integridad
    }
  }, {
    tableName: 'actividad',
    timestamps: false
  });

  // Agregamos el método associate
  Actividad.associate = (models) => {
    Actividad.belongsTo(models.TipoActividad, {
      foreignKey: 'tipo_actividad_id',
      as: 'tipo'
    });
    
    // Relaciones de herencia con subtipos
    Actividad.hasOne(models.Ejercicio, { foreignKey: 'id', as: 'ejercicio' });
    Actividad.hasOne(models.Miniproyecto, { foreignKey: 'id', as: 'miniproyecto' });
  };

  return Actividad;
};