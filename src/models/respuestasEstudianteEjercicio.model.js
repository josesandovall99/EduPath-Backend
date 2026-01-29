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
    // Mapeamos createdAt -> fecha_creacion según diagrama
    fecha_creacion: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'respuestas_estudiante_ejercicio',
    timestamps: true,
    createdAt: 'fecha_creacion',
    updatedAt: false,
    underscored: true,
    // Un solo registro final por estudiante+ejercicio (solo cuando sea correcto)
    indexes: [
      {
        unique: true,
        fields: ['estudiante_id', 'ejercicio_id'],
        name: 'ux_estudiante_ejercicio'
      }
    ]
  });

  return RespuestaEstudianteEjercicio;
};