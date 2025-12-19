module.exports = (sequelize, DataTypes) => {
  const Contenido = sequelize.define('Contenido', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    titulo: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    tipo: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    tema_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    subtema_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    }
  }, {
    tableName: 'contenidos',
    timestamps: false
  });

  Contenido.associate = models => {
    Contenido.belongsTo(models.Tema, { foreignKey: 'tema_id' });
    Contenido.belongsTo(models.Subtema, { foreignKey: 'subtema_id' });
  };

  return Contenido;
};
