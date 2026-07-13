import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const Badge = sequelize.define('Badge', {
  nbadge: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'nbadge',
  },
  b_nome: {
    type: DataTypes.STRING(50),
    field: 'b_nome',
  },
  b_descricao: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'b_descricao',
  },
  validade: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'validade',
  },
  pontos: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'pontos',
  },
  imagem: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'imagem',
  },
  ntipo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'ntipo',
    references: {
      model: 'tipo',
      key: 'ntipo',
    },
  },
}, {
  tableName: 'badge',
  timestamps: false,
  underscored: false,
});
