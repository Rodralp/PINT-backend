import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const Preferencia = sequelize.define('Preferencia', {
  nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'utilizador',
      key: 'nutilizador'
    }
  },
  narea: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'area',
      key: 'narea'
    }
  }
}, {
  tableName: 'preferencias',
  timestamps: false,
  underscored: false
});

