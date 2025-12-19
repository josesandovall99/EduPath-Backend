module.exports = (sequelize, DataTypes) => {
  const Ejercicio = sequelize.define('Ejercicio', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    actividad_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    subtema_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    puntos: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    enunciado_ejercicio: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    tableName: 'ejercicios',
    timestamps: false
  });

  Ejercicio.associate = models => {
    Ejercicio.belongsTo(models.Actividad, { foreignKey: 'actividad_id' });
    Ejercicio.belongsTo(models.Subtema, { foreignKey: 'subtema_id' });
    Ejercicio.hasMany(models.RespuestaEstudianteEjercicio, { foreignKey: 'ejercicio_id' });
    Ejercicio.hasMany(models.Evaluacion, { foreignKey: 'ejercicio_id' });
    Ejercicio.hasMany(models.Progreso, { foreignKey: 'ejercicio_id' });
  };

  return Ejercicio;
};
