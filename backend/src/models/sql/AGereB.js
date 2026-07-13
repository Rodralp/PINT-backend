import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const AGereB = sequelize.define('AGereB', {
  nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nutilizador',
    references: {
      model: 'utilizador',
      key: 'nutilizador',
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
  tableName: 'a_gere_b',
  timestamps: false,
  underscored: false,
});
