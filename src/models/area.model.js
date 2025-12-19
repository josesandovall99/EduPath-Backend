module.exports = (sequelize, DataTypes) => {
  const Area = sequelize.define('Area', {
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
    }
  }, {
    tableName: 'areas',
    timestamps: false
  });

  Area.associate = models => {
    Area.hasMany(models.Tema, { foreignKey: 'area_id' });
    Area.hasMany(models.Chatbot, { foreignKey: 'area_id' });
    Area.hasMany(models.Miniproyecto, { foreignKey: 'area_id' });
  };

  return Area;
};
