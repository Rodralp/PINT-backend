import { Team, TeamMember } from './sql/Team.js';
import { Account } from './sql/Account.js';
import { Op } from 'sequelize';

export const getAllTeams = async () => {
  try {
    const teams = await Team.findAll({
      include: [
        {
          model: Account,
          as: 'members',
          attributes: ['id', 'nome', 'email'],
          through: { attributes: [] },
        },
      ],
      order: [['id', 'DESC']],
    });

    return teams.map(team => ({
      id: team.id,
      name: team.nome,
      slaDescription: team.slaDescricao,
      expiryDate: team.slaDataExpiracao ? new Date(team.slaDataExpiracao).toLocaleDateString('pt-PT') : null,
      membersCount: team.members ? team.members.length : 0,
      members: team.members ? team.members.map(member => ({
        id: member.id,
        name: member.nome,
        email: member.email,
      })) : [],
    }));
  } catch (error) {
    console.error('Error getting all teams:', error.message);
    return [];
  }
};

export const getTeamsWithExpiringSLA = async (daysThreshold = 30) => {
  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    const teams = await Team.findAll({
      where: {
        slaDataExpiracao: {
          [Op.lte]: thresholdDate,
        },
      },
      include: [
        {
          model: Account,
          as: 'members',
          attributes: ['id', 'nome', 'email'],
          through: { attributes: [] },
        },
      ],
      order: [['slaDataExpiracao', 'ASC']],
    });

    return teams.map(team => {
      const now = new Date();
      const expiryDate = new Date(team.slaDataExpiracao);
      const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

      let priority = 'warning';
      let daysLabel = `Expira em ${daysUntilExpiry} dias`;

      if (daysUntilExpiry <= 7) {
        priority = 'critical';
        daysLabel = daysUntilExpiry <= 0 ? 'Expirado' : `Expira em ${daysUntilExpiry} dias`;
      } else if (daysUntilExpiry <= 14) {
        daysLabel = 'Expira em breve';
      }

      return {
        id: team.id,
        name: team.nome,
        slaDescription: team.slaDescricao,
        expiryDate: team.slaDataExpiracao ? new Date(team.slaDataExpiracao).toLocaleDateString('pt-PT') : null,
        daysLabel,
        priority,
        membersCount: team.members ? team.members.length : 0,
        members: team.members ? team.members.map(member => ({
          id: member.id,
          name: member.nome,
          email: member.email,
        })) : [],
      };
    });
  } catch (error) {
    console.error('Error getting teams with expiring SLA:', error.message);
    return [];
  }
};

export const getTeamById = async (teamId) => {
  try {
    const team = await Team.findByPk(teamId, {
      include: [
        {
          model: Account,
          as: 'members',
          attributes: ['id', 'nome', 'email'],
          through: { attributes: [] },
        },
      ],
    });

    if (!team) return null;

    return {
      id: team.id,
      name: team.nome,
      slaDescription: team.slaDescricao,
      expiryDate: team.slaDataExpiracao ? new Date(team.slaDataExpiracao).toLocaleDateString('pt-PT') : null,
      membersCount: team.members ? team.members.length : 0,
      members: team.members ? team.members.map(member => ({
        id: member.id,
        name: member.nome,
        email: member.email,
      })) : [],
    };
  } catch (error) {
    console.error('Error getting team by ID:', error.message);
    return null;
  }
};

export const createTeam = async (teamData) => {
  const { name, slaDescription, expiryDate, memberIds } = teamData;

  try {
    const newTeam = await Team.create({
      nome: name,
      slaDescricao: slaDescription,
      slaDataExpiracao: expiryDate ? new Date(expiryDate) : null,
    });

    if (memberIds && memberIds.length > 0) {
      const members = memberIds.map(userId => ({
        nequipa: newTeam.id,
        nutilizador: userId,
      }));
      await TeamMember.bulkCreate(members);
    }

    return await getTeamById(newTeam.id);
  } catch (error) {
    console.error('Error creating team:', error.message);
    throw error;
  }
};

export const updateTeam = async (teamId, teamData) => {
  const { name, slaDescription, expiryDate, memberIds } = teamData;

  try {
    const team = await Team.findByPk(teamId);
    if (!team) throw new Error('Team not found');

    await team.update({
      nome: name,
      slaDescricao: slaDescription,
      slaDataExpiracao: expiryDate ? new Date(expiryDate) : null,
    });

    await TeamMember.destroy({ where: { nequipa: teamId } });

    if (memberIds && memberIds.length > 0) {
      const members = memberIds.map(userId => ({
        nequipa: teamId,
        nutilizador: userId,
      }));
      await TeamMember.bulkCreate(members);
    }

    return await getTeamById(teamId);
  } catch (error) {
    console.error('Error updating team:', error.message);
    throw error;
  }
};

export const deleteTeam = async (teamId) => {
  try {
    await TeamMember.destroy({ where: { nequipa: teamId } });
    const team = await Team.findByPk(teamId);
    if (team) await team.destroy();
    return true;
  } catch (error) {
    console.error('Error deleting team:', error.message);
    throw error;
  }
};

export const getAllUsersForTeamSelection = async () => {
  try {
    const users = await Account.findAll({
      attributes: ['id', 'nome', 'email'],
      where: { status: 'ativo' },
      order: [['nome', 'ASC']],
      raw: true,
    });

    return users;
  } catch (error) {
    console.error('Error getting users for team selection:', error.message);
    return [];
  }
};
