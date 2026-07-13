import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const BadgeTrigger = sequelize.define('BadgeTrigger', {
  nbadge: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nbadge',
    references: {
      model: 'badge',
      key: 'nbadge',
    },
    onDelete: 'CASCADE',
  },
  trigger_tipo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    primaryKey: true,
    field: 'trigger_tipo',
  },
  trigger_valor: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'trigger_valor',
    validate: {
      min: 1,
    },
  },
}, {
  tableName: 'badge_trigger',
  timestamps: false,
  underscored: false,
});
