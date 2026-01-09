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
    }
  }, {
    tableName: 'contenidos',
    timestamps: false
  });

  Contenido.associate = models => {
    // Relaciones existentes
    Contenido.belongsTo(models.Tema, { foreignKey: 'tema_id' });
    Contenido.belongsTo(models.Subtema, { foreignKey: 'subtema_id' });

    // NUEVAS RELACIONES PARA SECUENCIAS
    // 1. Un contenido puede ser el ORIGEN de muchas secuencias (lo que sigue después)
    Contenido.hasMany(models.SecuenciaContenido, { 
      as: 'secuencias_salientes', 
      foreignKey: 'contenido_origen_id' 
    });

    // 2. Un contenido puede ser el DESTINO de muchas secuencias (lo que venía antes)
    Contenido.hasMany(models.SecuenciaContenido, { 
      as: 'secuencias_entrantes', 
      foreignKey: 'contenido_destino_id' 
    });
  };

  return Contenido;
};