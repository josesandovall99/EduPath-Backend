module.exports = (sequelize, DataTypes) => {
  const Asignatura = sequelize.define('Asignatura', {
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
    es_asignatura_pilar: {
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
    },
    /** Si es true, los estudiantes deben completar tema → subtema → contenido en orden configurado */
    progresion_secuencial: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    tableName: 'asignaturas',
    timestamps: false
  });

  // Método para centralizar las relaciones salientes de Asignatura
  Asignatura.associate = (models) => {
    // Relación con Temas
    Asignatura.hasMany(models.Tema, { 
      foreignKey: 'asignatura_id' 
    });

    // Relación con Chatbots (si existe el modelo)
    if (models.Chatbot) {
      Asignatura.hasMany(models.Chatbot, { 
        foreignKey: 'asignatura_id' 
      });
    }

    // Relación con Miniproyecto (La que movimos del index)
    Asignatura.hasMany(models.Miniproyecto, { 
      foreignKey: 'asignatura_id' 
    });

    // Relación con Docentes (1:N)
    Asignatura.hasMany(models.Docente, {
      foreignKey: 'asignatura_id',
      as: 'docentes'
    });
  };

  return Asignatura;
};