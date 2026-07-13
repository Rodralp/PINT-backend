import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const Notificacao = sequelize.define('Notificacao', {
  nnotificacao: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'nnotificacao'
  },
  nutilizador: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'utilizador',
      key: 'nutilizador'
    },
    field: 'nutilizador'
  },
  nlog: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'logs',
      key: 'nlog'
    },
    field: 'nlog'
  },
  lida: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'notificacao',
  timestamps: false,
  underscored: false
});

