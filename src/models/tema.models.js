module.exports = (sequelize, DataTypes) => {
  const Tema = sequelize.define('Tema', {
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
      defaultValue: true
    },
    area_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    }
  }, {
    tableName: 'temas',
    timestamps: false
  });

  Tema.associate = models => {
    Tema.belongsTo(models.Area, { foreignKey: 'area_id' });
    Tema.hasMany(models.Subtema, { foreignKey: 'tema_id' });
    Tema.hasMany(models.Contenido, { foreignKey: 'tema_id' });
  };

  return Tema;
};
