import { Router } from 'express';
import {
  getAllTeamsController,
  getTeamsWithExpiringSLAController,
  getTeamByIdController,
  createTeamController,
  updateTeamController,
  deleteTeamController,
  getAllUsersForTeamSelectionController,
} from '../controllers/teamController.js';

const router = Router();

// GET /api/teams - Get all teams
router.get('/', getAllTeamsController);

// GET /api/teams/expiring - Get teams with expiring SLA
router.get('/expiring', getTeamsWithExpiringSLAController);

// GET /api/teams/users - Get all users for team selection
router.get('/users', getAllUsersForTeamSelectionController);

// GET /api/teams/:id - Get team by ID
router.get('/:id', getTeamByIdController);

// POST /api/teams - Create new team
router.post('/', createTeamController);

// PUT /api/teams/:id - Update team
router.put('/:id', updateTeamController);

// DELETE /api/teams/:id - Delete team
router.delete('/:id', deleteTeamController);

export default router;
