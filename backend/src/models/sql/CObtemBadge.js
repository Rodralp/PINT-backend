import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const CObtemBadge = sequelize.define('CObtemBadge', {
  nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'utilizador',
      key: 'nutilizador'
    }
  },
  nbadge: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'badge',
      key: 'nbadge'
    }
  },
  npedido: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'pedidos',
      key: 'npedido'
    }
  },
  pontos_obtidos: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  data_obtencao: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'c_obtem_b',
  timestamps: false,
  underscored: false
});

