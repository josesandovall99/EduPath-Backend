
module.exports = (sequelize, DataTypes) => {

    const Miniproyecto = sequelize.define('Miniproyecto', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        area_id: {
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

    return Miniproyecto;
};
