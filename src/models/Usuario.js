import sequelize from "../config/db.js";
import { DataTypes } from "sequelize";

const Usuario = sequelize.define('Usuario', {
	cod_user: {
		type: DataTypes.STRING(8),
		allowNull: false,
		unique: true,
		validate: {
			is: /^[0-9]{8}$/
		}
	},
	id_user: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false
	},
	nombre: {
		type: DataTypes.STRING,
		allowNull: false
	},
	puntos: {
		type: DataTypes.FLOAT,
		allowNull: false
	},
	tipo: {
		type: DataTypes.STRING,
		allowNull: false
	},
	'contraseña': {
		type: DataTypes.STRING,
		allowNull: false
	},
	estado: {
		type: DataTypes.BOOLEAN,
		allowNull: false
	}
}, {
	tableName: 'usuario',
	timestamps: false
});

export default Usuario;
