import { authModel } from '../models/authModel.js';

export const authService = {
  async registerAccount(payload) {
    return authModel.register(payload);
  },

  async loginAccount(payload) {
    return authModel.login(payload);
  },

  async recoverPassword(email) {
    return authModel.recoverPassword(email);
  },

  async changePassword(payload) {
    return authModel.changePassword(payload);
  },

  async listServiceLines() {
    return authModel.listServiceLines();
  },

  async listAdminUsers(filters) {
    return authModel.listAdminUsers(filters);
  },

  async createAdminUser(payload) {
    return authModel.createAdminUser(payload);
  },

  async updateAdminUserPermissions(accountId, payload) {
    return authModel.updateAdminUserPermissions(accountId, payload);
  },

  async updateAdminUserStatus(accountId, payload) {
    return authModel.updateAdminUserStatus(accountId, payload);
  },

  async decidePendingUser(accountId, payload) {
    return authModel.decidePendingUser(accountId, payload);
  },
};
