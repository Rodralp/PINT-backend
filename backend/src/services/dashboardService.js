import { dashboardModel } from '../models/dashboardModel.js';

export const dashboardService = {
  async getTalentManagerDashboard(accountId) {
    return dashboardModel.getTalentManagerDashboardData(accountId);
  },

  async getServiceLineLeaderDashboard(accountId) {
    return dashboardModel.getServiceLineLeaderDashboardData(accountId);
  },

  async getAdminGestorDashboard(accountId) {
    return dashboardModel.getAdminGestorDashboardData(accountId);
  },

  async getConsultorDashboard(accountId) {
    return await dashboardModel.getConsultorDashboardData(accountId);
  },
};
