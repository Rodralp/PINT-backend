import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const SllLeaderSl = sequelize.define('SllLeaderSl', {
  nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nutilizador',
    references: {
      model: 'utilizador',
      key: 'nutilizador',
    },
  },
  nsline: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nsline',
    references: {
      model: 'service_line',
      key: 'nsline',
    },
  },
}, {
  tableName: 'sll_leader_sl',
  timestamps: false,
  underscored: false,
});
