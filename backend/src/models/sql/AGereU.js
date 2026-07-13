import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const AGereU = sequelize.define('AGereU', {
  nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nutilizador',
    references: {
      model: 'utilizador',
      key: 'nutilizador',
    },
  },
  adm_nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'adm_nutilizador',
    references: {
      model: 'utilizador',
      key: 'nutilizador',
    },
  },
}, {
  tableName: 'a_gere_u',
  timestamps: false,
  underscored: false,
});
