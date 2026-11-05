import sequelize from '../config/db.js';
import { DataTypes } from 'sequelize';

const UsuarioExcluidoRanking = sequelize.define('UsuarioExcluidoRanking', {
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
    tableName: 'usuario_excluido_ranking',
    timestamps: false,
});

export default UsuarioExcluidoRanking;
