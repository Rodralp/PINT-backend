import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const NivelContemBadge = sequelize.define('NivelContemBadge', {
  nnivel: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nnivel',
    references: {
      model: 'nivel',
      key: 'nnivel',
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
  tableName: 'nivel_contem_b',
  timestamps: false,
  underscored: false,
});
