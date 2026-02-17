module.exports = (sequelize, DataTypes) => {
  const Persona = sequelize.define(
    "Persona",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      nombre: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },

      codigoAcceso: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      contraseña: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      
      primer_ingreso: {
        type: DataTypes.BOOLEAN,
        field: "primer_ingreso", // Campo para saber si es el primer ingreso del estudiante
        defaultValue: true,
        allowNull: false
      },



      tipoUsuario: {
        type: DataTypes.ENUM("ESTUDIANTE", "ADMINISTRADOR", "DOCENTE"),
        allowNull: false,
      },

      fechaRegistro: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "personas",
      timestamps: true,
    }
  );

  return Persona;
};
