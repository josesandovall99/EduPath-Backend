module.exports = (sequelize, DataTypes) => {
  const SecuenciaSubtema = sequelize.define('SecuenciaSubtema', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    subtema_origen_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'subtemas', // Referencia a la tabla física
        key: 'id'
      }
    },
    subtema_destino_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'subtemas', // Referencia a la tabla física
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
    tableName: 'secuencia_subtemas',
    timestamps: false
  });

  SecuenciaSubtema.associate = (models) => {
    // Relación con el subtema de origen
    SecuenciaSubtema.belongsTo(models.Subtema, { 
      as: 'origen', 
      foreignKey: 'subtema_origen_id' 
    });

    // Relación con el subtema de destino
    SecuenciaSubtema.belongsTo(models.Subtema, { 
      as: 'destino', 
      foreignKey: 'subtema_destino_id' 
    });
  };

  return SecuenciaSubtema;
};
