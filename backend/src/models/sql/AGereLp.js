import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const AGereLp = sequelize.define('AGereLp', {
  nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nutilizador',
    references: {
      model: 'utilizador',
      key: 'nutilizador',
    },
  },
  nlpath: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'nlpath',
    references: {
      model: 'learning_path',
      key: 'nlpath',
    },
  },
}, {
  tableName: 'a_gere_lp',
  timestamps: false,
  underscored: false,
});
