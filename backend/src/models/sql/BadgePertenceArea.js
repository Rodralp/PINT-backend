import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const BadgePertenceArea = sequelize.define('BadgePertenceArea', {
  narea: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'narea',
    references: {
      model: 'area',
      key: 'narea',
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
  tableName: 'b_pertence_a',
  timestamps: false,
  underscored: false,
});
