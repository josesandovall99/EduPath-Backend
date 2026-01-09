module.exports = (sequelize, DataTypes) => {
  const SecuenciaContenido = sequelize.define('SecuenciaContenido', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    contenido_origen_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'contenidos', // Referencia a la tabla física
        key: 'id'
      }
    },
    contenido_destino_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'contenidos', // Referencia a la tabla física
        key: 'id'
      }
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    estado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    fecha_creacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'secuencia_contenidos',
    timestamps: false
  });

  SecuenciaContenido.associate = (models) => {
    // Relación con el contenido de origen
    SecuenciaContenido.belongsTo(models.Contenido, { 
      as: 'origen', 
      foreignKey: 'contenido_origen_id' 
    });

    // Relación con el contenido de destino
    SecuenciaContenido.belongsTo(models.Contenido, { 
      as: 'destino', 
      foreignKey: 'contenido_destino_id' 
    });
  };

  return SecuenciaContenido;
};