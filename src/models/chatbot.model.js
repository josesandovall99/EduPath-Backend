module.exports = (sequelize, DataTypes) => {
  const Chatbot = sequelize.define('Chatbot', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tipo: {
      type: DataTypes.ENUM('GENERAL', 'MINIPROYECTO'),
      allowNull: false,
      defaultValue: 'GENERAL',
    },
    prompt_base: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    area_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    miniproyecto_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    provider: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'ollama',
    },
    model_name: {
      type: DataTypes.STRING(120),
      allowNull: false,
      defaultValue: 'qwen2.5:0.5b',
    },
    top_k: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    max_context_chars: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 600,
    },
    max_tokens: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 256,
    },
    temperature: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.2,
    },
    estado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    creado_por_persona_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
  }, {
    tableName: 'chatbots',
    timestamps: true,
    underscored: true,
  });

  Chatbot.associate = (models) => {
    Chatbot.belongsTo(models.Area, {
      foreignKey: 'area_id',
      as: 'area',
    });

    Chatbot.belongsTo(models.Miniproyecto, {
      foreignKey: 'miniproyecto_id',
      as: 'miniproyecto',
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