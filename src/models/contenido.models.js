module.exports = (sequelize, DataTypes) => {
  const Contenido = sequelize.define('Contenido', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    titulo: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    tipo: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    tema_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    subtema_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    visualizado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'contenidos',
    timestamps: false
  });

  Contenido.associate = models => {
    // Relaciones básicas siempre presentes
    Contenido.belongsTo(models.Tema, { foreignKey: 'tema_id' });
    Contenido.belongsTo(models.Subtema, { foreignKey: 'subtema_id' });
    
    // Relación con Progreso
    Contenido.hasMany(models.Progreso, { foreignKey: 'contenido_id', as: 'progresos' });
    
    // Relación con Ejercicio
    Contenido.hasMany(models.Ejercicio, { foreignKey: 'contenido_id' });

    // Verificamos que el modelo existe antes de asociar para evitar el Error de subclass
    if (models.SecuenciaContenido) {
      Contenido.hasMany(models.SecuenciaContenido, { 
        as: 'secuencias_salientes', 
        foreignKey: 'contenido_origen_id' 
      });

      Contenido.hasMany(models.SecuenciaContenido, { 
        as: 'secuencias_entrantes', 
        foreignKey: 'contenido_destino_id' 
      });
    }
  };

  return Contenido;
};