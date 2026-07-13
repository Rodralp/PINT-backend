import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const Pedido = sequelize.define('Pedido', {
  npedido: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'npedido',
  },
  nbadge: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'nbadge',
    references: {
      model: 'badge',
      key: 'nbadge',
    },
  },
  nutilizador: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'nutilizador',
    references: {
      model: 'utilizador',
      key: 'nutilizador',
    },
  },
  estado: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'estado',
    references: {
      model: 'estado',
      key: 'nestado',
    },
  },
  data_submissao: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'data_submissao',
  },
  data_limite: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'data_limite',
  },
  descricao: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'descricao',
  },
}, {
  tableName: 'pedidos',
  timestamps: false,
  underscored: false,
});
