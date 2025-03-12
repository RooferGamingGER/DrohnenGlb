
const { Sequelize } = require('sequelize');

// Initialize Sequelize with PostgreSQL
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'dronenglb',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Import models
const User = require('./user')(sequelize);
const Project = require('./project')(sequelize);
const Measurement = require('./measurement')(sequelize);

// Define associations
User.hasMany(Project, { foreignKey: 'userId', as: 'projects' });
Project.belongsTo(User, { foreignKey: 'userId' });

Project.hasMany(Measurement, { foreignKey: 'projectId', as: 'measurements' });
Measurement.belongsTo(Project, { foreignKey: 'projectId' });

module.exports = {
  sequelize,
  User,
  Project,
  Measurement
};
