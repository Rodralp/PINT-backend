import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const SllGereP = sequelize.define('SllGereP', {
  ser_nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'ser_nutilizador',
    references: {
      model: 'utilizador',
      key: 'nutilizador',
    },
  },
  npedido: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'npedido',
    references: {
      model: 'pedidos',
      key: 'npedido',
    },
  },
}, {
  tableName: 'sll_gere_p',
  timestamps: false,
  underscored: false,
});
