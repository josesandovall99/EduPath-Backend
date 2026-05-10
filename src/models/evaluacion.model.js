module.exports = (sequelize, DataTypes) => {
  const Evaluacion = sequelize.define('Evaluacion', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    calificacion: {
      type: DataTypes.NUMERIC,
      allowNull: false
    },
    retroalimentacion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    estudiante_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    ejercicio_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    miniproyecto_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    estado: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    fecha_evaluacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    periodo_academico: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '2026-A'
    }
  }, {
    tableName: 'evaluacion',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['estudiante_id', 'ejercicio_id', 'periodo_academico'],
        name: 'ux_eval_estudiante_ejercicio_periodo'
      },
      {
        unique: true,
        fields: ['estudiante_id', 'miniproyecto_id', 'periodo_academico'],
        name: 'ux_eval_estudiante_miniproyecto_periodo'
      }
    ]
  });

  Evaluacion.associate = (models) => {
    Evaluacion.belongsTo(models.Estudiante, { foreignKey: 'estudiante_id' });
    Evaluacion.belongsTo(models.Ejercicio, { foreignKey: 'ejercicio_id' });
    Evaluacion.belongsTo(models.Miniproyecto, { foreignKey: 'miniproyecto_id' });
  };

  return Evaluacion;
};