import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const RgpdTopico = sequelize.define('RgpdTopico', {
  nrgpd: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'nrgpd'
  },
  titulo: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  corpo: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  ordem: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  }
}, {
  tableName: 'rgpd_topico',
  timestamps: false,
  underscored: false
});

