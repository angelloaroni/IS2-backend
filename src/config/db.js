import 'dotenv/config';
import Sequelize from 'sequelize';
import pg from 'pg';



const url = process.env.DATABASE_URL;

const sequelize = url
    ? new Sequelize(url, {
        dialect: 'postgres',
        dialectModule: pg,
        dialectOptions: {
            ssl: { require: true, rejectUnauthorized: false }
        },
        pool: { max: 2 },
        logging: false
    })
    : new Sequelize(
        process.env.DB_NAME || '',
        process.env.DB_USER || '',
        process.env.DB_PASSWORD || '',
        {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            dialect: 'postgres',
            dialectModule: pg,
            logging: false
        }
    );

export default sequelize;