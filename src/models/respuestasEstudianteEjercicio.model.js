module.exports = (sequelize, DataTypes) => {
  const RespuestaEstudianteEjercicio = sequelize.define('RespuestaEstudianteEjercicio', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    // Respuesta dinámica: permite texto, objetos o colecciones (JSONB)
    // Ejemplos por tipo:
    // - Compilador: { codigo: string, lenguaje?: string }
    // - Diagramas UML: { diagram: {...} }
    // - Preguntas: { respuestas: { [preguntaId]: valor } }
    // - Archivos: { archivos: [{ nombre, mime, tamano, ruta }] }
    respuesta: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    estudiante_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    ejercicio_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    estado: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    contador: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    // Mapeamos createdAt -> fecha_creacion según diagrama
    fecha_creacion: {
      type: DataTypes.DATE,
      allowNull: true
    },
    periodo_academico: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "2026-A"
    }
  }, {
    tableName: 'respuestas_estudiante_ejercicio',
    timestamps: true,
    createdAt: 'fecha_creacion',
    updatedAt: false,
    underscored: true,
    // Un registro por estudiante+ejercicio+periodo; permite re-intentos en nuevos periodos
    indexes: [
      {
        unique: true,
        fields: ['estudiante_id', 'ejercicio_id', 'periodo_academico'],
        name: 'ux_estudiante_ejercicio_periodo'
      }
    ]
  });

  return RespuestaEstudianteEjercicio;
};