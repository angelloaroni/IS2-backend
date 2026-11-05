import sequelize from '../config/db.js';
import { DataTypes } from 'sequelize';

const ConfiguracionRanking = sequelize.define('ConfiguracionRanking', {
    id_config: {
        type: DataTypes.SMALLINT,
        primaryKey: true,
        allowNull: false,
    },
    desde: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    hasta: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
}, {
    tableName: 'configuracion_ranking',
    timestamps: false,
});

export default ConfiguracionRanking;
