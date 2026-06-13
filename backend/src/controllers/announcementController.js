import fs from 'node:fs';
import path from 'node:path';
import { communicationService } from '../services/communicationService.js';

const parseAccountId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseRecipientIds = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return trimmed.split(',').map((entry) => entry.trim()).filter(Boolean);
    }
  }

  if (typeof value === 'number') {
    return [value];
  }

  return [];
};

export const getAnnouncementRecipients = async (_req, res) => {
  try {
    const data = await communicationService.listRecipients();
    res.status(200).json(data);
  } catch {
    res.status(500).json({ message: 'Failed to load recipients.' });
  }
};

export const getUserAnnouncements = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);

  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const data = await communicationService.getUserAnnouncements(accountId);
    res.status(200).json(data);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ message: error?.message || 'Failed to fetch announcements.' });
  }
};

export const createAnnouncement = async (req, res) => {
  const accountId = parseAccountId(req.body?.accountId);
  const title = String(req.body?.title || '').trim();
  const message = String(req.body?.message || '').trim();
  const type = String(req.body?.type || '').trim();
  const priority = req.body?.priority;
  const recipientIds = parseRecipientIds(req.body?.recipientIds);

  if (!accountId || !title || !message || recipientIds.length === 0) {
    res.status(400).json({ message: 'Missing required fields.' });
    return;
  }

  try {
    const data = await communicationService.createAnnouncement({
      accountId,
      title,
      message,
      type,
      priority,
      recipientIds,
      files: req.files,
    });

    res.status(201).json(data);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ message: error?.message || 'Failed to create announcement.' });
  }
};

export const downloadAnnouncementAttachment = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);
  const logId = parseAccountId(req.params?.logId);
  const fileId = parseAccountId(req.params?.fileId);

  if (!accountId || !logId || !fileId) {
    res.status(400).json({ message: 'Account id, log id and file id are required.' });
    return;
  }

  try {
    const file = await communicationService.getAnnouncementAttachment(accountId, logId, fileId);
    if (!file) {
      res.status(404).json({ message: 'Attachment not found.' });
      return;
    }

    const uploadsDir = path.resolve(globalThis.process?.cwd?.() || '.', 'uploads');
    const resolvedFilePath = path.resolve(uploadsDir, file.storedName);
    const isInsideUploadsDir = resolvedFilePath === uploadsDir || resolvedFilePath.startsWith(`${uploadsDir}${path.sep}`);

    if (!isInsideUploadsDir || !fs.existsSync(resolvedFilePath)) {
      res.status(404).json({ message: 'Attachment file not found on server.' });
      return;
    }

    res.download(resolvedFilePath, file.originalName);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ message: error?.message || 'Failed to download attachment.' });
  }
};
