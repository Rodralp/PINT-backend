import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Account = sequelize.define(
  'Account',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'nutilizador',
    },
    nome: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isValidEmail(value) {
          if (typeof value !== 'string' || !EMAIL_PATTERN.test(value)) {
            throw new Error('Email must be a valid email address.');
          }
        },
      },
    },
    senha: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'consultor',
      field: 'permissoes',
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pendente',
    },
  },
  {
    tableName: 'utilizador',
    underscored: true,
    timestamps: false,
    hooks: {
      beforeValidate(account) {
        if (typeof account.email === 'string') {
          account.email = account.email.trim().toLowerCase();
        }
      },
      beforeCreate(account) {
        if (typeof account.nome === 'string') {
          account.nome = account.nome.trim();
        }
      },
    },
  },
);