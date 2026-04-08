module.exports = (sequelize, DataTypes) => {
  const ChatbotDocumento = sequelize.define(
    'ChatbotDocumento',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      chatbot_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      nombre_archivo: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      nombre_original: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      ruta_archivo: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      mime_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      tamano_bytes: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      estado: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'chatbot_documentos',
      timestamps: true,
    }
  );

  ChatbotDocumento.associate = (models) => {
    ChatbotDocumento.belongsTo(models.Chatbot, {
      foreignKey: 'chatbot_id',
      as: 'chatbot',
    });
  };

  return ChatbotDocumento;
};