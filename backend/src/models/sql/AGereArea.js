import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const AGereArea = sequelize.define('AGereArea', {
  nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nutilizador',
    references: {
      model: 'utilizador',
      key: 'nutilizador',
    },
  },
  narea: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'narea',
    references: {
      model: 'area',
      key: 'narea',
    },
  },
}, {
  tableName: 'a_gere_area',
  timestamps: false,
  underscored: false,
});
