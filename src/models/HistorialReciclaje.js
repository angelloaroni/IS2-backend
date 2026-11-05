import sequelize from "../config/db.js";
import { DataTypes } from "sequelize";

const HistorialReciclaje = sequelize.define('HistorialReciclaje', {
    id_historial: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false
    },
    fecha:{
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    fecha_instante: {
        type: DataTypes.DATE,
        allowNull: true
    },
    id_user:{
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuario',
            key: 'id_user'
        }
    },
    id_tacho:{
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'tachointeligente',
            key: 'id_tacho'
        }
    },
    id_residuo:{
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'residuo',
            key: 'id_residuo'
        }
    }}
    ,{
        tableName: 'historialreciclaje',
        timestamps: false
    });

    export default HistorialReciclaje
