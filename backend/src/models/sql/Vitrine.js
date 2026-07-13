import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const Vitrine = sequelize.define('Vitrine', {
  nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'utilizador',
      key: 'nutilizador'
    },
    onDelete: 'CASCADE'
  },
  nbadge: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'badge',
      key: 'nbadge'
    },
    onDelete: 'CASCADE'
  },
  ordem: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'vitrine',
  timestamps: false,
  underscored: false
});

