import sequelize from "../config/db.js";
import { DataTypes } from "sequelize";

const TachoInteligente = sequelize.define('TachoInteligente', {
	id_tacho: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false
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
