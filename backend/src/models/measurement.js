
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Measurement = sequelize.define('Measurement', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Projects',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('length', 'height', 'area'),
      allowNull: false
    },
    points: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    value: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    unit: {
      type: DataTypes.STRING,
      defaultValue: 'm'
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true
    }
  });

  return Measurement;
};
