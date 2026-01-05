module.exports = (sequelize, DataTypes) => {
  const RespuestaEstudianteEjercicio = sequelize.define('RespuestaEstudianteEjercicio', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    // RECTIFICADO: Usamos 'respuesta' para que coincida con la DB física
    respuesta: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    respuesta_esperada: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Dentro de tu archivo .model.js, busca idioma_id y cámbialo a esto:
    idioma_id: {
      type: DataTypes.INTEGER,
      allowNull: true, // Lo ponemos en true para que no bloquee el insert si falla el nombre
      field: 'idioma_id' // <--- Si en tu DB se llama diferente, cámbialo aquí
    },
    estudiante_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    ejercicio_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    token: {
      type: DataTypes.STRING,
      allowNull: true
    },
    estado: {
      type: DataTypes.STRING,
      defaultValue: 'Processing'
    },
    calificacion: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    // Campos para almacenar lo que devuelve Judge0
    stdout: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    stderr: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    compile_output: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'respuestas_estudiante_ejercicio', // Nombre exacto de la tabla en Render
    timestamps: true,
    underscored: true // Esto ayuda si tus columnas usan created_at en lugar de createdAt
  });

  return RespuestaEstudianteEjercicio;
};