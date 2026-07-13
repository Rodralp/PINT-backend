import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const AdmGereP = sequelize.define('AdmGereP', {
  adm_nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'adm_nutilizador',
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
  tableName: 'adm_gere_p',
  timestamps: false,
  underscored: false,
});
