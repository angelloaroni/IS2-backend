import sequelize from "../config/db.js";
import { DataTypes } from "sequelize";

const Residuo = sequelize.define('Residuo', {
	id_residuo: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false
	},
	nombre: {
		type: DataTypes.STRING,
		allowNull: false
	},
	peso: {
		type: DataTypes.FLOAT,
		allowNull: false
	},
	tipo: {
		type: DataTypes.STRING,
		allowNull: false
	},
	id_user: {
		type: DataTypes.INTEGER,
		allowNull: false,
		references: {
			model: 'usuario',
			key: 'id_user'
		}
	},
	id_tacho: {
		type: DataTypes.INTEGER,
		allowNull: false,
		references: {
			model: 'tachointeligente',
			key: 'id_tacho'
		}
	}
}, {
	tableName: 'residuo',
	timestamps: false
});

export default Residuo;
