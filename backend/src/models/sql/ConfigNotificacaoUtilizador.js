import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const ConfigNotificacaoUtilizador = sequelize.define('ConfigNotificacaoUtilizador', {
  nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'utilizador',
      key: 'nutilizador'
    },
    field: 'nutilizador',
    onDelete: 'CASCADE'
  },
  chave: {
    type: DataTypes.STRING(80),
    primaryKey: true,
    allowNull: false
  },
  valor: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  }
}, {
  tableName: 'config_notificacao_utilizador',
  timestamps: false,
  underscored: false
});

