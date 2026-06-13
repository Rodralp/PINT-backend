import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const Reminder = sequelize.define(
  'Reminder',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'nlembrete',
    },
    accountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'nutilizador',
      references: {
        model: 'utilizador',
        key: 'nutilizador',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'titulo',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'descricao',
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'data_lembrete',
    },
    color: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'cor',
    },
  },
  {
    tableName: 'lembrete',
    timestamps: false,
    underscored: true,
    hooks: {
      beforeCreate(reminder) {
        reminder.title = reminder.title.trim();
        reminder.description = reminder.description.trim();
      },
      beforeUpdate(reminder) {
        reminder.title = reminder.title.trim();
        reminder.description = reminder.description.trim();
      },
    },
  },
);