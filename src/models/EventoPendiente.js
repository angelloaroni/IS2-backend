import sequelize from '../config/db.js';
import { DataTypes } from 'sequelize';

const EventoPendiente = sequelize.define('EventoPendiente', {
    id_evento: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
    },
    referencia_evento: {
        type: DataTypes.STRING(160),
        allowNull: false,
        unique: true,
    },
    tipo: {
        type: DataTypes.STRING(64),
        allowNull: false,
    },
    payload: {
        type: DataTypes.JSONB,
        allowNull: false,
    },
    creado_en: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'evento_pendiente',
    timestamps: false,
});

export default EventoPendiente;
