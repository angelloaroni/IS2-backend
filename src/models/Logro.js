import sequelize from "../config/db.js";
import { DataTypes } from "sequelize";

const Logro = sequelize.define('Logros', {
	id_logro: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false
	},
	nombre: {
		type: DataTypes.STRING,
		allowNull: false
	},
	tipo_condicion: {
		type: DataTypes.STRING,
		allowNull: false
	},
	valor_objetivo: {
		type: DataTypes.FLOAT,
		allowNull: false
	}
}, {
	tableName: 'logros',
	timestamps: false
});

export default Logro;
