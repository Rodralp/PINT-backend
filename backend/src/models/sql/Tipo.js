import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const Tipo = sequelize.define('Tipo', {
  ntipo: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'ntipo',
  },
  tipo: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    field: 'tipo',
  },
  pontos: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'pontos',
  },
  level_key: {
    type: DataTypes.STRING(50),
    field: 'level_key',
  },
}, {
  tableName: 'tipo',
  timestamps: false,
  underscored: false,
});
