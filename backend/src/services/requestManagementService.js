import { requestManagementModel } from '../models/requestManagementModel.js';

export const requestManagementService = {
  getManagedRequests(role, accountId) {
    return requestManagementModel.getManagedRequests(role, accountId);
  },

  getManagedRequestById(role, accountId, requestId) {
    return requestManagementModel.getManagedRequestById(role, accountId, requestId);
  },

  getManagedEvidenceFile(role, accountId, requestId, evidenceId) {
    return requestManagementModel.getManagedEvidenceFile(role, accountId, requestId, evidenceId);
  },

  submitDecision(role, accountId, requestId, payload) {
    return requestManagementModel.submitDecision(role, accountId, requestId, payload);
  },
};
