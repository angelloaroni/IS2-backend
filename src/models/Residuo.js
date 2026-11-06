import sequelize from "../config/db.js";
import { DataTypes } from "sequelize";

const Residuo = sequelize.define('Residuo', {
	id_residuo: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false
	},
	peso: {
		type: DataTypes.FLOAT,
		allowNull: false
	},
	puntos_ganados: {
		type: DataTypes.DOUBLE,
		allowNull: false
	},
	tipo: {
		type: DataTypes.STRING(32),
		allowNull: false
	},
	idempotency_key: {
		type: DataTypes.STRING(128),
		allowNull: true,
		unique: true
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
