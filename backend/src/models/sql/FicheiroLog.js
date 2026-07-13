import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const FicheiroLog = sequelize.define('FicheiroLog', {
  nflog: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'nflog'
  },
  nlog: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'logs',
      key: 'nlog'
    },
    field: 'nlog',
    onDelete: 'CASCADE'
  },
  nome_original: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'nome_original'
  },
  nome_armazenado: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'nome_armazenado'
  },
  tipo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  tamanho: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  caminho: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  data_upload: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'data_upload'
  }
}, {
  tableName: 'ficheiro_log',
  timestamps: false,
  underscored: false
});

