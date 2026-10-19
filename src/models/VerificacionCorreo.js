import sequelize from '../config/db.js';
import { DataTypes } from 'sequelize';

const VerificacionCorreo = sequelize.define(
    'VerificacionCorreo',
    {
        id_verificacion: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            field: 'id_verificacion',
        },
        correo_institucional: {
            type: DataTypes.STRING(254),
            allowNull: false,
        },
        proposito: {
            type: DataTypes.STRING(16),
            allowNull: false,
        },
        codigo_hash: {
            type: DataTypes.CHAR(64),
            allowNull: false,
        },
        id_user: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        expira_en: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        intentos: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 0,
        },
        verificado_en: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        token_hash: {
            type: DataTypes.CHAR(64),
            allowNull: true,
        },
        token_expira_en: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        utilizado_en: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        creado_en: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        tableName: 'verificacion_correo',
        timestamps: false,
    }
);

export default VerificacionCorreo;
