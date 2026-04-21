module.exports = (sequelize, DataTypes) => {
  const Area = sequelize.define('Area', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    es_area_pilar: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    tipo_pilar: {
      type: DataTypes.ENUM('PROGRAMACION', 'ANALISIS', 'ATC'),
      allowNull: true,
      defaultValue: null
    },
    miniproyecto_plantilla_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      defaultValue: null
    },
    miniproyecto_publicado_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      defaultValue: null
    },
    estado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    tableName: 'areas',
    timestamps: false
  });

  // Método para centralizar las relaciones salientes de Area
  Area.associate = (models) => {
    // Relación con Temas
    Area.hasMany(models.Tema, { 
      foreignKey: 'area_id' 
    });

    // Relación con Chatbots (si existe el modelo)
    if (models.Chatbot) {
      Area.hasMany(models.Chatbot, { 
        foreignKey: 'area_id' 
      });
    }

    // Relación con Miniproyecto (La que movimos del index)
    Area.hasMany(models.Miniproyecto, { 
      foreignKey: 'area_id' 
    });

    // Relación con Docentes (1:N)
    Area.hasMany(models.Docente, {
      foreignKey: 'area_id',
      as: 'docentes'
    });
  };

  return Area;
};