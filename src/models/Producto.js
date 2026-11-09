import sequelize from '../config/db.js';
import { DataTypes } from 'sequelize';

const Producto = sequelize.define('Producto', {
    id_producto: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
    },
    cod_producto: {
        type: DataTypes.STRING(8),
        allowNull: false,
        unique: true,
        validate: {
            is: /^[0-9]{8}$/,
        },
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    peso_gramos: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
        },
    },
    tipo: {
        type: DataTypes.STRING(16),
        allowNull: false,
    },
}, {
    tableName: 'producto',
    timestamps: false,
});

export default Producto;
