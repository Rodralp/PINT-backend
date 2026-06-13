import { dashboardService } from '../services/dashboardService.js';

export const getTalentManagerDashboard = async (req, res) => {
  try {
    console.log('🔄 Backend: getTalentManagerDashboard called, accountId:', req.query?.accountId);
    const dashboardData = await dashboardService.getTalentManagerDashboard(req.query?.accountId);
    console.log('✅ Backend: Dashboard data ready, topConsultores:', dashboardData.topConsultores.length);
    res.status(200).json(dashboardData);
  } catch (error) {
    console.error('❌ Backend: Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data.', error: error.message });
  }
};

export const getServiceLineLeaderDashboard = async (req, res) => {
  try {
    const dashboardData = await dashboardService.getServiceLineLeaderDashboard(req.query?.accountId);
    res.status(200).json(dashboardData);
  } catch (error) {
    console.error('❌ Backend SLL Error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data.', error: error.message, stack: error.stack });
  }
};

export const getAdminGestorDashboard = async (req, res) => {
  try {
    const dashboardData = await dashboardService.getAdminGestorDashboard(req.query?.accountId);
    res.status(200).json(dashboardData);
  } catch (error) {
    console.error('❌ Backend AG Error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data.', error: error.message, stack: error.stack });
  }
};

export const getConsultorDashboard = async (req, res) => {
  try {
    const dashboardData = await dashboardService.getConsultorDashboard(req.query.accountId);
    res.status(200).json(dashboardData);
  } catch {
    res.status(500).json({ message: 'Failed to fetch dashboard data.' });
  }
};
