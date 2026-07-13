import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const Area = sequelize.define('Area', {
  narea: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'narea',
  },
  area: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'area',
  },
  a_desc: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'a_desc',
  },
  nsline: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'nsline',
    references: {
      model: 'service_line',
      key: 'nsline',
    },
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'area',
  timestamps: false,
  underscored: false,
});
