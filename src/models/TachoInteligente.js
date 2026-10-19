import sequelize from "../config/db.js";
import { DataTypes } from "sequelize";

const TachoInteligente = sequelize.define('TachoInteligente', {
	id_tacho: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false
	},
	tipo: {
		type: DataTypes.STRING(32),
		allowNull: true
	},
	latitud: {
		type: DataTypes.FLOAT,
		allowNull: false
	},
	longitud: {
		type: DataTypes.FLOAT,
		allowNull: false
	},
	capacidad: {
		type: DataTypes.BOOLEAN,
		allowNull: false
	},
	porcentaje: {
		type: DataTypes.FLOAT,
		allowNull: true,
		validate: {
			min: 0,
			max: 100
		}
	},
	estado: {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: true
	}
}, {
	tableName: 'tachointeligente',
	timestamps: false
});

export default TachoInteligente;
