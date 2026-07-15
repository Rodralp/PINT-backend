import { adminGeneralManagementModel } from '../models/adminGeneralManagementModel.js';

export const adminGeneralManagementService = {
  listGeneralManagement() {
    return adminGeneralManagementModel.listGeneralManagement();
  },

  updateNotificationSettings(rows) {
    return adminGeneralManagementModel.updateNotificationSettings(rows);
  },

  updateRgpdTopics(rows) {
    return adminGeneralManagementModel.updateRgpdTopics(rows);
  },
};
