import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const ServiceLine = sequelize.define('ServiceLine', {
  nsline: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'nsline',
  },
  sline: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'sline',
  },
  sl_desc: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'sl_desc',
  },
  imagem: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'imagem',
  },
  nlpath: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'nlpath',
    references: {
      model: 'learning_path',
      key: 'nlpath',
    },
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'service_line',
  timestamps: false,
  underscored: false,
});
