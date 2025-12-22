const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Estudiante = sequelize.define(
  "Estudiante",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      references: {
        model: Persona,
        key: "id",
      },
    },

    programa: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    semestre: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "estudiante",
    timestamps: false,
  }
);

/* RELACIÓN 1 A 1 (HERENCIA) */
Persona.hasOne(Estudiante, { foreignKey: "id" });
Estudiante.belongsTo(Persona, { foreignKey: "id" });

export default Estudiante;
