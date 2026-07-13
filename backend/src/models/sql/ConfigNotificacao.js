import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const ConfigNotificacao = sequelize.define('ConfigNotificacao', {
  nconfig: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'nconfig'
  },
  evento: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true
  },
  admin: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  sll: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  tl: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  consultor: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  email: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  web_app: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'web_app'
  }
}, {
  tableName: 'config_notificacao',
  timestamps: false,
  underscored: false
});

