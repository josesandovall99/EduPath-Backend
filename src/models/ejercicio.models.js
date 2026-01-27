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
    puntos: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    resultado_ejercicio: {
      type: DataTypes.TEXT,
      allowNull: false
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
