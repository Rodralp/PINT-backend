import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const ConfigGeral = sequelize.define('ConfigGeral', {
  nconfig: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'nconfig'
  },
  chave: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true
  },
  valor: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  opcoes: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    allowNull: false,
    defaultValue: []
  }
}, {
  tableName: 'config_geral',
  timestamps: false,
  underscored: false
});

