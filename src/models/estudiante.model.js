module.exports = (sequelize, DataTypes) => {
  const Estudiante = sequelize.define(
    "Estudiante",
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

      codigoEstudiantil: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },

      semestre: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      programa: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      tableName: "estudiantes",
      timestamps: true,
    }
  );

  return Estudiante;
};
