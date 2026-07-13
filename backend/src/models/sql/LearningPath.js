import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const LearningPath = sequelize.define('LearningPath', {
  nlpath: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'nlpath',
  },
  lpath: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'lpath',
  },
  lp_desc: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'lp_desc',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'learning_path',
  timestamps: false,
  underscored: false,
});
