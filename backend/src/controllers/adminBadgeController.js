import { adminBadgeService } from '../services/adminBadgeService.js';
import { adminLearningPathService } from '../services/adminLearningPathService.js';
import { adminBadgeModel } from '../models/adminBadgeModel.js';

const specialTriggerTypes = new Set(['badge_count', 'ranking_position', 'streak_days']);
const MAX_BADGE_IMAGE_LENGTH = 2_500_000;

const parseEntityId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeText = (value, maxLength) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  if (Number.isInteger(maxLength) && maxLength > 0) {
    return normalized.slice(0, maxLength);
  }

  return normalized;
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
};

const parsePoints = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseTypeIdentifier = (value) => {
  if (Number.isInteger(value) && value > 0) {
    return value;
  }

  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  const parsedNumeric = Number(normalized);
  if (Number.isInteger(parsedNumeric) && parsedNumeric > 0) {
    return parsedNumeric;
  }

  return normalized;
};

const parseBadgeImage = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length > MAX_BADGE_IMAGE_LENGTH) {
    return null;
  }

  return normalized;
};

const parseSpecialRequirements = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenTypes = new Set();
  const requirements = [];

  for (const item of value) {
    const type = String(item?.type || '').trim();
    const parsedValue = Number(item?.value);

    if (!specialTriggerTypes.has(type)) {
      continue;
    }

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      continue;
    }

    if (seenTypes.has(type)) {
      continue;
    }

    seenTypes.add(type);
    requirements.push({ type, value: parsedValue });
  }

  return requirements;
};

const parseStandardRequirements = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const title = normalizeText(item?.title || item?.requisito, 50);
      const description = normalizeText(item?.description || item?.r_descricao, 255);
      const image = parseBadgeImage(item?.image || item?.imagem);

      if (!title || !description) {
        return null;
      }

      return { title, description, image };
    })
    .filter(Boolean);
};

const toBadgeResponse = (row) => ({
  id: `badge-${Number(row.nbadge)}`,
  badgeDbId: Number(row.nbadge),
  name: row.b_nome,
  description: row.b_descricao,
  points: Number(row.pontos) || 0,
  badgeImage: row.imagem || null,
  levelId: row.levelId || null,
  levelTitle: row.levelTitle || null,
  isSpecial: Boolean(row.isSpecial),
  typeName: row.typeName || null,
  typeId: row.typeKey || null,
  specialRequirements: Array.isArray(row.specialRequirements) ? row.specialRequirements : [],
  requirements: Array.isArray(row.requirements) ? row.requirements : [],
  validade: row.validade || null,
});

export const getBadge = async (req, res) => {
  const badgeId = parseEntityId(req.params?.badgeId);

  if (!badgeId) {
    res.status(400).json({ message: 'Badge id is required.' });
    return;
  }

  try {
    const row = await adminBadgeService.getBadge(badgeId);
    if (!row) {
      res.status(404).json({ message: 'Badge not found.' });
      return;
    }

    res.status(200).json(toBadgeResponse(row));
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch badge.' });
  }
};

export const createBadge = async (req, res) => {
  const name = normalizeText(req.body?.name, 25);
  const description = normalizeText(req.body?.description, 255);
  const isSpecial = parseBoolean(req.body?.isSpecial);
  const levelId = parseEntityId(req.body?.levelId);
  const points = parsePoints(req.body?.points);
  const typeId = parseTypeIdentifier(req.body?.typeId);
  const badgeImage = parseBadgeImage(req.body?.badgeImage);
  const specialRequirements = parseSpecialRequirements(req.body?.specialRequirements);
  const requirements = parseStandardRequirements(req.body?.requirements);
  const validade = req.body?.validade || null;

  if (!name) {
    res.status(400).json({ message: 'Name is required.' });
    return;
  }

  if (points !== null && points < 0) {
    res.status(400).json({ message: 'Points cannot be negative.' });
    return;
  }

  const badgeDescription = description || `Badge ${name}`;
  const specialFlag = isSpecial === null ? false : isSpecial;

  if (!specialFlag && !levelId) {
    res.status(400).json({ message: 'Level id is required for standard badges.' });
    return;
  }

  if (!specialFlag && !typeId) {
    res.status(400).json({ message: 'Type id is required for standard badges.' });
    return;
  }

  if (specialFlag && specialRequirements.length === 0) {
    res.status(400).json({ message: 'At least one special trigger is required.' });
    return;
  }

  if (validade) {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 7);
    const validadeDate = new Date(validade);
    if (validadeDate < minDate) {
      res.status(400).json({ message: 'A data de expiração deve ser pelo menos 7 dias no futuro.' });
      return;
    }
  }

  if (!specialFlag) {
    const levelExists = await adminLearningPathService.hasLevel(levelId);
    if (!levelExists) {
      res.status(404).json({ message: 'Level not found.' });
      return;
    }
  }

  try {
    const row = await adminBadgeService.createBadge({
      name,
      description: badgeDescription,
      points,
      levelId,
      isSpecial: specialFlag,
      typeId,
      badgeImage,
      specialRequirements,
      requirements,
      validade,
    });

    if (!row) {
      res.status(400).json({ message: 'Unable to create badge.' });
      return;
    }

    res.status(201).json(toBadgeResponse(row));
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to create badge.' });
  }
};

export const updateBadge = async (req, res) => {
  const badgeId = parseEntityId(req.params?.badgeId);
  const name = normalizeText(req.body?.name, 25);
  const description = normalizeText(req.body?.description, 255);
  const isSpecial = parseBoolean(req.body?.isSpecial);
  const levelId = parseEntityId(req.body?.levelId);
  const points = parsePoints(req.body?.points);
  const typeId = parseTypeIdentifier(req.body?.typeId);
  const badgeImage = parseBadgeImage(req.body?.badgeImage);
  const specialRequirements = parseSpecialRequirements(req.body?.specialRequirements);
  const requirements = parseStandardRequirements(req.body?.requirements);
  const validade = req.body?.validade || null;

  if (!badgeId) {
    res.status(400).json({ message: 'Badge id is required.' });
    return;
  }

  if (!name) {
    res.status(400).json({ message: 'Name is required.' });
    return;
  }

  if (points !== null && points < 0) {
    res.status(400).json({ message: 'Points cannot be negative.' });
    return;
  }

  const badgeDescription = description || `Badge ${name}`;
  const specialFlag = isSpecial === null ? false : isSpecial;

  if (!specialFlag && !levelId) {
    res.status(400).json({ message: 'Level id is required for standard badges.' });
    return;
  }

  if (!specialFlag && !typeId) {
    res.status(400).json({ message: 'Type id is required for standard badges.' });
    return;
  }

  if (specialFlag && specialRequirements.length === 0) {
    res.status(400).json({ message: 'At least one special trigger is required.' });
    return;
  }

  if (validade) {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 7);
    const validadeDate = new Date(validade);
    if (validadeDate < minDate) {
      res.status(400).json({ message: 'A data de expiração deve ser pelo menos 7 dias no futuro.' });
      return;
    }
  }

  if (!specialFlag) {
    const levelExists = await adminLearningPathService.hasLevel(levelId);
    if (!levelExists) {
      res.status(404).json({ message: 'Level not found.' });
      return;
    }
  }

  try {
    const row = await adminBadgeService.updateBadge({
      badgeId,
      name,
      description: badgeDescription,
      points,
      levelId,
      isSpecial: specialFlag,
      typeId,
      badgeImage,
      specialRequirements,
      requirements,
      validade,
    });

    if (!row) {
      res.status(404).json({ message: 'Badge not found.' });
      return;
    }

    res.status(200).json(toBadgeResponse(row));
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to update badge.' });
  }
};

export const getExpiringSoonBadges = async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const badges = await adminBadgeModel.getExpiringSoonBadges(days);
    res.status(200).json(badges);
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch expiring badges.' });
  }
};


