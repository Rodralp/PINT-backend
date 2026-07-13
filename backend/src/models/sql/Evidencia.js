import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const Evidencia = sequelize.define('Evidencia', {
  nevidencias: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'nevidencias',
  },
  nevidencia: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'nevidencia',
  },
  e_data_submissao: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'e_data_submissao',
  },
  formato: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'formato',
  },
  nreq: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'nreq',
    references: {
      model: 'requisitos',
      key: 'nreq',
    },
  },
  npedido: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'npedido',
    references: {
      model: 'pedidos',
      key: 'npedido',
    },
  },
}, {
  tableName: 'evidencias',
  timestamps: false,
  underscored: false,
});
