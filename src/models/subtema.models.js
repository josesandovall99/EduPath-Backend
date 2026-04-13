module.exports = (sequelize, DataTypes) => {
  const Subtema = sequelize.define('Subtema', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    estado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    tema_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    }
  }, {
    tableName: 'subtemas',
    timestamps: false
  });

  Subtema.associate = models => {
    Subtema.belongsTo(models.Tema, { foreignKey: 'tema_id' });
    Subtema.hasMany(models.Contenido, { foreignKey: 'subtema_id' });
  };

  return Subtema;
};
