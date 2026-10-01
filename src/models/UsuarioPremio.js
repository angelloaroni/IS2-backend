import sequelize from "../config/db.js";
import { DataTypes } from "sequelize";

const UsuarioPremio = sequelize.define('usuario_Premio', {
    id_usuario_premio: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false
    },
    fecha_obtencion: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    id_premio: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'premio',
            key: 'id_premio'
        }
    },
    id_user: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuario',
            key: 'id_user'
        }
    }},{
        tableName: 'usuario_premio',
        timestamps: false
    }
);
export default UsuarioPremio;