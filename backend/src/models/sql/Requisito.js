import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const Requisito = sequelize.define('Requisito', {
  nreq: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'nreq',
  },
  requisito: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'requisito',
  },
  r_descricao: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'r_descricao',
  },
  imagem: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'imagem',
  },
  nbadge: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'nbadge',
    references: {
      model: 'badge',
      key: 'nbadge',
    },
  },
}, {
  tableName: 'requisitos',
  timestamps: false,
  underscored: false,
});
