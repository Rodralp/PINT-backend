import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const Nivel = sequelize.define('Nivel', {
  nnivel: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'nnivel',
  },
  nivel: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    field: 'nivel',
  },
  narea: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'narea',
    references: {
      model: 'area',
      key: 'narea',
    },
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'nivel',
  timestamps: false,
  underscored: false,
});
