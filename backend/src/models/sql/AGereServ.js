import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const AGereServ = sequelize.define('AGereServ', {
  nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nutilizador',
    references: {
      model: 'utilizador',
      key: 'nutilizador',
    },
  },
  nsline: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nsline',
    references: {
      model: 'service_line',
      key: 'nsline',
    },
  },
}, {
  tableName: 'a_gere_serv',
  timestamps: false,
  underscored: false,
});
