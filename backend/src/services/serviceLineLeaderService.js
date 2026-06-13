import { serviceLineLeaderModel } from '../models/serviceLineLeaderModel.js';

export const serviceLineLeaderService = {
  async getMyServiceLine(accountId) {
    return serviceLineLeaderModel.getMyServiceLine(accountId);
  },
};
