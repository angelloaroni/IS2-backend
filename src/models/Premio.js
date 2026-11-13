import sequelize from "../config/db.js";
import { DataTypes } from "sequelize";

const Premio = sequelize.define('Premio', {
    id_premio: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false
    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: false
    },
    descripcion: {
        type: DataTypes.STRING,
        allowNull: false
    },
    costo: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    estado: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    stock: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
},{
    tableName: 'premio',
    timestamps: false
});

export default Premio;
