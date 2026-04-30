module.exports = (sequelize, DataTypes) => {
  const ChatbotDocumento = sequelize.define('ChatbotDocumento', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    chatbot_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    nombre_archivo: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    nombre_original: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    ruta_archivo: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'application/pdf',
    },
    tamano_bytes: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    estado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    contenido_pdf: {
      type: DataTypes.BLOB,
      allowNull: true,
    },
  }, {
    tableName: 'chatbot_documentos',
    timestamps: true,
    underscored: true,
  });

  ChatbotDocumento.associate = (models) => {
    ChatbotDocumento.belongsTo(models.Chatbot, {
      foreignKey: 'chatbot_id',
      as: 'chatbot',
    });
  };

  return ChatbotDocumento;
};