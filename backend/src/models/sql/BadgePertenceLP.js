import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const BadgePertenceLP = sequelize.define('BadgePertenceLP', {
  nlpath: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nlpath',
    references: {
      model: 'learning_path',
      key: 'nlpath',
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
  tableName: 'b_pertence_lp',
  timestamps: false,
  underscored: false,
});
