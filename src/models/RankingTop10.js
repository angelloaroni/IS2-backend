import sequelize from '../config/db.js';
import { DataTypes } from 'sequelize';

const RankingTop10 = sequelize.define('RankingTop10', {
    periodo: {
        type: DataTypes.STRING(7),
        primaryKey: true,
        allowNull: false,
    },
    id_user: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
            model: 'usuario',
            key: 'id_user',
        },
    },
}, {
    tableName: 'ranking_top10_estado',
    timestamps: false,
});

export default RankingTop10;
