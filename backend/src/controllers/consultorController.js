import { consultorService } from '../services/consultorService.js';
import { adminBadgeModel } from '../models/adminBadgeModel.js';
import fs from 'fs';
import path from 'path';

const parseAccountId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const getCatalogBadges = async (req, res) => {
  try {
    const includeExpired = req.query.includeExpired === 'true';
    const data = await consultorService.getCatalogBadges(includeExpired);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch catalog badges.', error: error.message });
  }
};

export const getLearningPaths = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);
  
  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const data = await consultorService.getLearningPaths(accountId);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch learning paths.', error: error.message });
  }
};

export const getMyBadges = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);

  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const data = await consultorService.getMyBadges(accountId);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch badges.', error: error.message });
  }
};

export const acquireBadge = async (req, res) => {
  const accountId = parseAccountId(req.body?.accountId);
  const badgeId = parseAccountId(req.params?.badgeId);

  if (!accountId || !badgeId) {
    res.status(400).json({ message: 'Account id and badge id are required.' });
    return;
  }

  try {
    const data = await consultorService.requestBadgeAcquisition(accountId, badgeId);
    res.status(200).json(data);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ message: error?.message || 'Failed to submit badge request.' });
  }
};

export const getPreferenceAreas = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);
  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const data = await consultorService.getPreferenceAreas(accountId);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch preference areas.', error: error.message });
  }
};

export const getPreferences = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);
  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const data = await consultorService.getPreferences(accountId);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch preferences.', error: error.message });
  }
};

export const savePreferences = async (req, res) => {
  const accountId = parseAccountId(req.body?.accountId);
  const areaIds = Array.isArray(req.body?.areaIds) ? req.body.areaIds : [];

  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const data = await consultorService.savePreferences(accountId, areaIds);
    res.status(200).json(data);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ message: error?.message || 'Failed to save preferences.' });
  }
};

export const getBadgeSuggestions = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);
  const limit = Number(req.query?.limit);

  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const data = await consultorService.getBadgeSuggestions(accountId, limit);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch suggestions.', error: error.message });
  }
};

export const getMyRequests = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);
  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const data = await consultorService.getMyRequests(accountId);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch requests.', error: error.message });
  }
};

export const getPedidoDetail = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);
  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  const pedidoId = Number(req.params?.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    res.status(400).json({ message: 'Invalid pedido id.' });
    return;
  }

  try {
    const data = await consultorService.getPedidoDetail(accountId, pedidoId);
    if (!data) {
      res.status(404).json({ message: 'Pedido not found.' });
      return;
    }
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch pedido detail.', error: error.message });
  }
};

export const getRankingConsultores = async (_req, res) => {
  try {
    const data = await consultorService.getRankingConsultores();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch ranking.', error: error.message });
  }
};

export const getReminders = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);
  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const data = await consultorService.getReminders(accountId);
    res.status(200).json(data);
  } catch {
    res.status(500).json({ message: 'Failed to fetch reminders.' });
  }
};

export const createReminder = async (req, res) => {
  const { title, description, date, color, accountId: rawAccountId } = req.body ?? {};
  const accountId = parseAccountId(rawAccountId);

  if (!title || !description || !date || !color || !accountId) {
    res.status(400).json({ message: 'Missing required fields.' });
    return;
  }

  try {
    const data = await consultorService.createReminder(accountId, { title, description, date, color });
    res.status(201).json(data);
  } catch {
    res.status(500).json({ message: 'Failed to create reminder.' });
  }
};

export const updateReminder = async (req, res) => {
  const { title, description, date, color, accountId: rawAccountId } = req.body ?? {};
  const accountId = parseAccountId(rawAccountId);

  if (!title || !description || !date || !color || !accountId) {
    res.status(400).json({ message: 'Missing required fields.' });
    return;
  }

  try {
    const data = await consultorService.updateReminder(req.params.id, accountId, { title, description, date, color });
    if (!data) {
      res.status(404).json({ message: 'Reminder not found.' });
      return;
    }

    res.status(200).json(data);
  } catch {
    res.status(500).json({ message: 'Failed to update reminder.' });
  }
};

export const deleteReminder = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);
  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const deleted = await consultorService.deleteReminder(req.params.id, accountId);
    if (!deleted) {
      res.status(404).json({ message: 'Reminder not found.' });
      return;
    }

    res.status(204).send();
  } catch {
    res.status(500).json({ message: 'Failed to delete reminder.' });
  }
};

export const getProfileData = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);

  try {
    const data = await consultorService.getProfileData(accountId);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch profile data.', error: error.message });
  }
};

export const updateProfileData = async (req, res) => {
  const accountId = parseAccountId(req.body?.accountId);

  if (!accountId) {
    res.status(400).json({ message: 'accountId is required.' });
    return;
  }

  try {
    const result = await consultorService.updateProfileData(accountId, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update profile data.', error: error.message });
  }
};

export const uploadEvidence = async (req, res) => {
  const pedidoId = Number(req.params?.pedidoId);
  const nreq = Number(req.body?.nreq);
  const accountId = Number(req.body?.accountId);

  if (!pedidoId || Number.isNaN(nreq) || !accountId) {
    res.status(400).json({ message: 'pedidoId, nreq and accountId are required.' });
    return;
  }

  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      res.status(400).json({ message: 'No files provided.' });
      return;
    }

    const uploadsDir = path.resolve(globalThis.process?.cwd?.() || '.', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const saved = [];
    for (const f of files) {
      const originalName = f.originalname || f.filename;
      const ext = path.extname(originalName).replace(/\./g, '') || '';
      const storedName = path.basename(f.path);

      const result = await consultorService.saveEvidences(accountId, pedidoId, nreq, {
        filename: storedName,
        originalName,
        formato: ext,
      });

      saved.push(result);
    }

    res.status(201).json({ uploaded: saved });
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to upload evidences.' });
  }
};

export const getBadgeRequirements = async (req, res) => {
  const badgeId = req.params?.badgeId;

  if (!badgeId) {
    res.status(400).json({ message: 'Badge id is required.' });
    return;
  }

  try {
    const data = await consultorService.getBadgeRequirements(badgeId);
    res.status(200).json(data || []);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch badge requirements.', error: error.message });
  }
};

export const getExpiringSoonBadgesForUser = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);

  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const days = Number(req.query?.days) || 30;
    const badges = await adminBadgeModel.getExpiringSoonBadgesForUser(accountId, days);
    res.status(200).json(badges);
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch expiring badges.' });
  }
};
