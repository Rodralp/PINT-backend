import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const Log = sequelize.define('Log', {
  nlog: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'nlog'
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
  data_log: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'data_log'
  },
  tipo_log: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'tipo_log'
  },
  titulo: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  mensagem: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  resumo: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  prioridade: {
    type: DataTypes.INTEGER,
    defaultValue: 2
  }
}, {
  tableName: 'logs',
  timestamps: false,
  underscored: false
});

