import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const TmGereP = sequelize.define('TmGereP', {
  tm_nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'tm_nutilizador',
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
  tableName: 'tm_gere_p',
  timestamps: false,
  underscored: false,
});
