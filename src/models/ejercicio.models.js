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
      type: DataTypes.ENUM('Compilador', 'Diagramas UML', 'Preguntas', 'Opción única', 'Ordenar', 'Relacionar'),
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
    codigoEstructura: {
      type: DataTypes.VIRTUAL,
      get() {
        const configuracion = this.getDataValue('configuracion') || {};
        return configuracion?.metodo?.plantilla || null;
      },
      set(value) {
        const configuracionActual = this.getDataValue('configuracion') || {};
        const metodoActual = configuracionActual.metodo || {};

        this.setDataValue('configuracion', {
          ...configuracionActual,
          metodo: {
            ...metodoActual,
            plantilla: value || null,
          },
        });
      }
    },
    configuracion: {
      // Estructura dinámica para preguntas/respuestas por área
      // Compilador: {
      //   tipo: 'programacion',
      //   esperado?: '...' (compatibilidad),
      //   lenguajesPermitidos?: [ids],
      //   metodo?: { nombre, retorno, parametros, plantilla },
      //   casos_prueba?: [{ inputs: '5,3', output: '8' }, ...],
      //   sintaxis?: ['for', 'while']
      // }
      // Diagramas UML / Preguntas: { tipo: 'cuestionario', preguntas: [{ id, enunciado, tipo, opciones?, respuesta_correcta? }] }
      // Opción única: { tipo: 'opcion-unica', enunciado: '...', opciones: [...], respuestaCorrecta: '...' }
      // Ordenar: { tipo: 'ordenar', enunciado: '...', items: [...] }
      // Relacionar: { tipo: 'relacionar', enunciado: '...', pares: [{ concepto, definicion }] }
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
