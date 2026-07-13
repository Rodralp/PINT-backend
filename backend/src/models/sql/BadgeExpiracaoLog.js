import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const BadgeExpiracaoLog = sequelize.define('BadgeExpiracaoLog', {
  nlog_expiracao: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nbadge: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'badge',
      key: 'nbadge'
    },
    onDelete: 'CASCADE'
  },
  data_expiracao: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  data_processamento: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  pedidos_rejeitados: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  nivel_desativado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'badge_expiracao_log',
  timestamps: false,
  underscored: false,
  indexes: [
    { unique: true, fields: ['nbadge', 'data_expiracao'] }
  ]
});

