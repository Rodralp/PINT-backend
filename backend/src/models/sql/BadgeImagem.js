import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const BadgeImagem = sequelize.define('BadgeImagem', {
  nbadge: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'badge',
      key: 'nbadge'
    },
    onDelete: 'CASCADE'
  },
  mime_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'image/png'
  },
  dados: {
    type: DataTypes.BLOB('long'),
    allowNull: false
  },
  criado_em: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  atualizado_em: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'badge_imagem',
  timestamps: false,
  underscored: false
});

