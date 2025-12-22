module.exports = (sequelize, DataTypes) => {
  return sequelize.define('TipoActividad', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: DataTypes.TEXT,
    descripcion: DataTypes.TEXT
  }, {
    tableName: 'tipoactividad',
    timestamps: false
  });
};
