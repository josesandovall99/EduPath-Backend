module.exports = (sequelize, DataTypes) => {
  const Chatbot = sequelize.define(
    'Chatbot',
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
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      prompt_base: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      area_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      creado_por_persona_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      provider: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'ollama',
      },
      model_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      temperature: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.2,
      },
      top_k: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
      max_tokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 256,
      },
      estado: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'chatbots',
      timestamps: true,
    }
  );

  Chatbot.associate = (models) => {
    Chatbot.belongsTo(models.Area, {
      foreignKey: 'area_id',
      as: 'area',
    });

    Chatbot.belongsTo(models.Persona, {
      foreignKey: 'creado_por_persona_id',
      as: 'creador',
    });

    Chatbot.hasMany(models.ChatbotDocumento, {
      foreignKey: 'chatbot_id',
      as: 'documentos',
      onDelete: 'CASCADE',
      hooks: true,
    });
  };

  return Chatbot;
};