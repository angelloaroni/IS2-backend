import sequelize from '../config/db.js';
import { DataTypes } from 'sequelize';

const EntregaEvento = sequelize.define('EntregaEvento', {
    id_evento: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        allowNull: false,
        references: {
            model: 'evento_pendiente',
            key: 'id_evento',
        },
    },
    consumidor: {
        type: DataTypes.STRING(32),
        primaryKey: true,
        allowNull: false,
    },
    entregado_en: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    intentos: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    ultimo_error: {
        type: DataTypes.STRING(1000),
        allowNull: true,
    },
    proximo_intento_en: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: 'entrega_evento',
    timestamps: false,
});

export default EntregaEvento;
