module.exports = (sequelize, DataTypes) => {
  const Ejercicio = sequelize.define('Ejercicio', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      allowNull: false // será el mismo id de Actividad
    },
    subtema_id: {
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
    // Aquí NO pongas foreignKey: 'id' otra vez
    Ejercicio.belongsTo(models.Subtema, { foreignKey: 'subtema_id' });
  };

  return Ejercicio;
};
