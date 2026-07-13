import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const Motivo = sequelize.define('Motivo', {
  npedido: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'npedido',
    references: {
      model: 'pedidos',
      key: 'npedido',
    },
  },
  nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nutilizador',
    references: {
      model: 'utilizador',
      key: 'nutilizador',
    },
  },
  motivo_desc: {
    type: DataTypes.STRING(280),
    allowNull: true,
    field: 'motivo_desc',
  },
}, {
  tableName: 'motivo',
  timestamps: false,
  underscored: false,
});
