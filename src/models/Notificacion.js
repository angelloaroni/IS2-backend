import sequelize from '../config/db.js';
import { DataTypes } from 'sequelize';

const Notificacion = sequelize.define('Notificacion', {
    id_notificacion: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
    },
    id_user: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuario',
            key: 'id_user',
        },
    },
    tipo: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    titulo: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    mensaje: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    leida: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    referencia_evento: {
        type: DataTypes.STRING(160),
        allowNull: true,
        unique: true,
    },
}, {
    tableName: 'notificacion',
    timestamps: false,
});

export default Notificacion;