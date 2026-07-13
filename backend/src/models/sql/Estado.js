import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const Estado = sequelize.define('Estado', {
  nestado: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'nestado',
  },
  estado: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'estado',
  },
}, {
  tableName: 'estado',
  timestamps: false,
  underscored: false,
});
