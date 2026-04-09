const { Sequelize } = require('sequelize');
require('dotenv').config();

const rawDatabaseUrl = process.env.DATABASE_URL?.trim();
const databaseUrl = rawDatabaseUrl
  ? rawDatabaseUrl
      .replace(/\?sslmode=require$/i, '')
      .replace(/&sslmode=require/gi, '')
  : rawDatabaseUrl;
const dbSslEnabled = (process.env.DB_SSL || 'true').trim().toLowerCase() !== 'false';

const baseConfig = {
  dialect: 'postgres',
  logging: false,
};

if (dbSslEnabled) {
  baseConfig.dialectOptions = {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  };
}

const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, baseConfig)
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        ...baseConfig,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
      }
    );

module.exports = sequelize;
