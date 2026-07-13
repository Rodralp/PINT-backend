import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const UtilizadorImagem = sequelize.define('UtilizadorImagem', {
  nutilizador: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'utilizador',
      key: 'nutilizador'
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
  tableName: 'utilizador_imagem',
  timestamps: false,
  underscored: false
});

