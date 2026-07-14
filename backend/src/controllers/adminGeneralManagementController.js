import { adminGeneralManagementService } from '../services/adminGeneralManagementService.js';

const getRowsPayload = (payload) => (Array.isArray(payload) ? payload : null);

export const getGeneralManagement = async (_req, res) => {
  try {
    const data = await adminGeneralManagementService.listGeneralManagement();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch general management data.' });
  }
};

export const updateNotificationSettings = async (req, res) => {
  const rows = getRowsPayload(req.body?.rows);

  if (!rows) {
    res.status(400).json({ message: 'Rows are required.' });
    return;
  }

  try {
    const notifications = await adminGeneralManagementService.updateNotificationSettings(rows);
    res.status(200).json({ notifications });
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to update notification settings.' });
  }
};

export const updateRgpdTopics = async (req, res) => {
  const rows = getRowsPayload(req.body?.rows);

  if (!rows) {
    res.status(400).json({ message: 'Rows are required.' });
    return;
  }

  try {
    const rgpd = await adminGeneralManagementService.updateRgpdTopics(rows);
    res.status(200).json({ rgpd });
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to update RGPD topics.' });
  }
};

export const updateGeneralSettings = async (req, res) => {
  const rows = getRowsPayload(req.body?.rows);

  if (!rows) {
    res.status(400).json({ message: 'Rows are required.' });
    return;
  }

  try {
    const settings = await adminGeneralManagementService.updateGeneralSettings(rows);
    res.status(200).json({ settings });
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to update general settings.' });
  }
};
