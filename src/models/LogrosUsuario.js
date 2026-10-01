import sequelize from "../config/db.js";
import { DataTypes } from "sequelize";

const LogrosUsuario = sequelize.define('Logros_Usuario', {
    fecha_obtencion: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    id_logro: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
            model: 'logros',
            key: 'id_logro'
        }
    },
    id_user: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
            model: 'usuario',
            key: 'id_user'
        }
    }
},{
    tableName: 'logros_usuario',
    timestamps: false
});

export default LogrosUsuario;
