const { Sequelize } = require('sequelize');
const { db } = require('./env');

// schema.sql owns the table definitions, so sequelize.sync() is never called.
const sequelize = new Sequelize(db.name, db.user, db.password, {
  host: db.host,
  port: db.port,
  dialect: 'mysql',
  timezone: db.timezone,
  logging: false,
  dialectOptions: { decimalNumbers: true, charset: 'utf8mb4_unicode_ci' },
  pool: { max: 10, min: 0, idle: 10000 },
  define: { timestamps: false, freezeTableName: true, underscored: true },
});

module.exports = sequelize;
