import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';
import { Account } from './Account.js';

// Team model matching the actual schema_postgresql.sql
// Table: equipa (nequipa, equipa, sla, sla_expiracao)
// Table: u_pertence_equipa (nequipa, nutilizador)

export const Team = sequelize.define(
  'Team',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'nequipa',
    },
    nome: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'equipa',
    },
    slaDescricao: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'sla',
    },
    slaDataExpiracao: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'sla_expiracao',
    },
  },
  {
    tableName: 'equipa',
    underscored: false,
    timestamps: false,
  },
);

export const TeamMember = sequelize.define(
  'TeamMember',
  {
    teamId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      field: 'nequipa',
      references: {
        model: Team,
        key: 'nequipa',
      },
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      field: 'nutilizador',
      references: {
        model: Account,
        key: 'nutilizador',
      },
    },
  },
  {
    tableName: 'u_pertence_equipa',
    underscored: false,
    timestamps: false,
  },
);

// Define relationships
Team.belongsToMany(Account, {
  through: TeamMember,
  foreignKey: 'nequipa',
  otherKey: 'nutilizador',
  as: 'members',
});

Account.belongsToMany(Team, {
  through: TeamMember,
  foreignKey: 'nutilizador',
  otherKey: 'nequipa',
  as: 'teams',
});
