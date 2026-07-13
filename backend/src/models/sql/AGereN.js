import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const AGereN = sequelize.define('AGereN', {
  nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nutilizador',
    references: {
      model: 'utilizador',
      key: 'nutilizador',
    },
  },
  nnivel: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nnivel',
    references: {
      model: 'nivel',
      key: 'nnivel',
    },
  },
}, {
  tableName: 'a_gere_n',
  timestamps: false,
  underscored: false,
});
