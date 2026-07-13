import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const PedidoHistorico = sequelize.define('PedidoHistorico', {
  nhistorico: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'nhistorico',
  },
  npedido: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'npedido',
    references: {
      model: 'pedidos',
      key: 'npedido',
    },
  },
  nestado: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'nestado',
    references: {
      model: 'estado',
      key: 'nestado',
    },
  },
  nutilizador: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'nutilizador',
    references: {
      model: 'utilizador',
      key: 'nutilizador',
    },
  },
  data_estado: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'data_estado',
  },
  descricao: {
    type: DataTypes.STRING(280),
    allowNull: true,
    field: 'descricao',
  },
}, {
  tableName: 'pedido_historico',
  timestamps: false,
  underscored: false,
});
