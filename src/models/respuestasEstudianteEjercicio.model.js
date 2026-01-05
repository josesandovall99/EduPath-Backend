module.exports = (sequelize, DataTypes) => {
  const RespuestaEstudianteEjercicio = sequelize.define('RespuestaEstudianteEjercicio', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    respuesta: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    token: {
      type: DataTypes.STRING,
      allowNull: true
    },
    stdout: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    estado: {
      type: DataTypes.STRING,
      defaultValue: 'Processing'
    },
    estudiante_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    ejercicio_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    // CAMBIO: De idioma_id a lenguaje_id
    lenguaje_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'lenguaje_id' 
    }
  }, {
    tableName: 'respuestas_estudiante_ejercicio', 
    timestamps: true,
    underscored: true 
  });

  return RespuestaEstudianteEjercicio;
};