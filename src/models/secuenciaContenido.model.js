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
        model: 'contenidos', // Nombre de la tabla en la DB
        key: 'id'
      }
    },
    contenido_destino_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'contenidos',
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

  // Aquí definimos las asociaciones
  SecuenciaContenido.associate = (models) => {
    // Una secuencia tiene un origen (Contenido)
    SecuenciaContenido.belongsTo(models.Contenido, { 
      as: 'origen', 
      foreignKey: 'contenido_origen_id' 
    });

    // Una secuencia tiene un destino (Contenido)
    SecuenciaContenido.belongsTo(models.Contenido, { 
      as: 'destino', 
      foreignKey: 'contenido_destino_id' 
    });
  };

  return SecuenciaContenido;
};