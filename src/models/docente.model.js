module.exports = (sequelize, DataTypes) => {
  const Docente = sequelize.define(
    "Docente",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      persona_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      area_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },

      especialidad: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      tableName: "docentes",
      timestamps: true,
    }
  );

  return Docente;
};
