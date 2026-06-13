import { adminBadgeModel } from '../models/adminBadgeModel.js';

export const adminBadgeService = {
  createBadge(payload) {
    return adminBadgeModel.createBadge(payload);
  },

  updateBadge(payload) {
    return adminBadgeModel.updateBadge(payload);
  },

  getBadge(badgeId) {
    return adminBadgeModel.getBadge(badgeId);
  },
};
