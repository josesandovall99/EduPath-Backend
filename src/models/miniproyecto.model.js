module.exports = (sequelize, DataTypes) => {
    const Miniproyecto = sequelize.define('Miniproyecto', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            // Importante: autoIncrement false porque hereda el ID de Actividad
            autoIncrement: false 
        },
        actividad_id: {
            type: DataTypes.BIGINT,
            allowNull: false
        },
        asignatura_id: {
            type: DataTypes.BIGINT,
            allowNull: false
        },
        entregable: {
            type: DataTypes.TEXT
        },
        respuesta_miniproyecto: {
            type: DataTypes.TEXT
        }
    }, {
        tableName: 'miniproyecto',
        timestamps: false
    });

    // Añadimos la asociación con Asignatura
    Miniproyecto.associate = (models) => {
        Miniproyecto.belongsTo(models.Asignatura, {
            foreignKey: 'asignatura_id'
        });

        if (models.Chatbot) {
            Miniproyecto.hasMany(models.Chatbot, {
                foreignKey: 'miniproyecto_id',
                as: 'chatbots'
            });
        }
    };

    return Miniproyecto;
};