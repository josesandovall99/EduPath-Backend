module.exports = (sequelize, DataTypes) => {
  const Administrador = sequelize.define(
    "Administrador",
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

      cargo: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      nivelAcceso: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      tableName: "administradores",
      timestamps: true,
    }
  );

  return Administrador;
};
