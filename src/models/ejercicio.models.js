module.exports = (sequelize, DataTypes) => {
  const Ejercicio = sequelize.define('Ejercicio', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: false, // No auto-incrementa porque hereda el id de Actividad
      allowNull: false
    },
    contenido_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    tipo_ejercicio: {
      type: DataTypes.ENUM('Compilador', 'Diagramas UML', 'Preguntas'),
      allowNull: false,
      defaultValue: 'Compilador'
    },
    puntos: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    resultado_ejercicio: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    configuracion: {
      // Estructura dinámica para preguntas/respuestas por área
      // Compilador: { tipo: 'programacion', esperado: '...', lenguajesPermitidos?: [ids] }
      // Diagramas UML / Preguntas: { tipo: 'cuestionario', preguntas: [{ id, enunciado, tipo, opciones?, respuesta_correcta? }] }
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    tableName: 'ejercicios',
    timestamps: false
  });

  Ejercicio.associate = models => {
    // Herencia: Ejercicio ES UNA Actividad (comparten el mismo id)
    Ejercicio.belongsTo(models.Actividad, { foreignKey: 'id', as: 'actividad' });
    // Relación con Contenido
    Ejercicio.belongsTo(models.Contenido, { foreignKey: 'contenido_id' });
  };

  return Ejercicio;
};
