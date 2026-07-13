import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const BadgePertenceSL = sequelize.define('BadgePertenceSL', {
  nsline: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nsline',
    references: {
      model: 'service_line',
      key: 'nsline',
    },
  },
  nbadge: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nbadge',
    references: {
      model: 'badge',
      key: 'nbadge',
    },
  },
}, {
  tableName: 'b_pertence_sl',
  timestamps: false,
  underscored: false,
});
