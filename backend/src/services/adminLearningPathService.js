import { adminLearningPathModel } from '../models/adminLearningPathModel.js';

export const adminLearningPathService = {
  listLearningPaths() {
    return adminLearningPathModel.listLearningPaths();
  },

  createLearningPath(payload) {
    return adminLearningPathModel.createLearningPath(payload);
  },

  updateLearningPath(payload) {
    return adminLearningPathModel.updateLearningPath(payload);
  },

  createServiceLine(payload) {
    return adminLearningPathModel.createServiceLine(payload);
  },

  updateServiceLine(payload) {
    return adminLearningPathModel.updateServiceLine(payload);
  },

  createArea(payload) {
    return adminLearningPathModel.createArea(payload);
  },

  updateArea(payload) {
    return adminLearningPathModel.updateArea(payload);
  },

  createLevel(payload) {
    return adminLearningPathModel.createLevel(payload);
  },

  updateLevel(payload) {
    return adminLearningPathModel.updateLevel(payload);
  },

  updateLearningPathStatus(payload) {
    return adminLearningPathModel.updateLearningPathStatus(payload);
  },

  updateServiceLineStatus(payload) {
    return adminLearningPathModel.updateServiceLineStatus(payload);
  },

  updateAreaStatus(payload) {
    return adminLearningPathModel.updateAreaStatus(payload);
  },

  updateLevelStatus(payload) {
    return adminLearningPathModel.updateLevelStatus(payload);
  },

  hasLearningPath(learningPathId) {
    return adminLearningPathModel.hasLearningPath(learningPathId);
  },

  hasServiceLine(serviceLineId) {
    return adminLearningPathModel.hasServiceLine(serviceLineId);
  },

  hasArea(areaId) {
    return adminLearningPathModel.hasArea(areaId);
  },

  hasLevel(levelId) {
    return adminLearningPathModel.hasLevel(levelId);
  },
};
