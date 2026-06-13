import {
  getAllTeams,
  getTeamsWithExpiringSLA,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getAllUsersForTeamSelection,
} from '../models/teamModel.js';

export const getAllTeamsController = async (req, res) => {
  try {
    const teams = await getAllTeams();
    res.json(teams);
  } catch (error) {
    console.error('Error in getAllTeamsController:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
};

export const getTeamsWithExpiringSLAController = async (req, res) => {
  try {
    const { days } = req.query;
    const daysThreshold = days ? parseInt(days) : 30;
    const teams = await getTeamsWithExpiringSLA(daysThreshold);
    res.json(teams);
  } catch (error) {
    console.error('Error in getTeamsWithExpiringSLAController:', error);
    res.status(500).json({ error: 'Failed to fetch teams with expiring SLA' });
  }
};

export const getTeamByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const team = await getTeamById(id);
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    res.json(team);
  } catch (error) {
    console.error('Error in getTeamByIdController:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
};

export const createTeamController = async (req, res) => {
  try {
    const teamData = req.body;
    const newTeam = await createTeam(teamData);
    res.status(201).json(newTeam);
  } catch (error) {
    console.error('Error in createTeamController:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
};

export const updateTeamController = async (req, res) => {
  try {
    const { id } = req.params;
    const teamData = req.body;
    const updatedTeam = await updateTeam(id, teamData);
    
    if (!updatedTeam) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    res.json(updatedTeam);
  } catch (error) {
    console.error('Error in updateTeamController:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
};

export const deleteTeamController = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await deleteTeam(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error in deleteTeamController:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
};

export const getAllUsersForTeamSelectionController = async (req, res) => {
  try {
    const users = await getAllUsersForTeamSelection();
    res.json(users);
  } catch (error) {
    console.error('Error in getAllUsersForTeamSelectionController:', error);
    res.status(500).json({ error: 'Failed to fetch users for team selection' });
  }
};
