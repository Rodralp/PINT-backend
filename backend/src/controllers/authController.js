import { authService } from '../services/authService.js';
import { UniqueConstraintError, ValidationError } from 'sequelize';
import { RgpdTopico } from '../models/sql/RgpdTopico.js';

export const register = async (req, res) => {
  const { nome, email, senha } = req.body ?? {};

  if (!nome || !email || !senha) {
    res.status(400).json({ message: 'Missing required fields.' });
    return;
  }

  try {
    const account = await authService.registerAccount({ nome, email, senha });
    if (!account) {
      res.status(409).json({ message: 'Failed to register account.' });
      return;
    }

    res.status(201).json(account);
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      res.status(409).json({ message: 'Failed to register account.' });
      return;
    }

    if (error instanceof ValidationError) {
      res.status(400).json({
        message: 'Failed to register account.',
        details: error.errors.map((item) => item.message),
      });
      return;
    }

    res.status(500).json({ message: 'Failed to register account.' });
  }
};

export const login = async (req, res) => {
  const { email, senha } = req.body ?? {};

  if (!email || !senha) {
    res.status(400).json({ message: 'Missing required fields.' });
    return;
  }

  try {
    const loginResult = await authService.loginAccount({ email, senha });

    if (!loginResult || loginResult.status === 'invalid_credentials') {
      res.status(401).json({ message: 'Invalid credentials.' });
      return;
    }

    if (loginResult.status === 'pending_approval') {
      res.status(403).json({
        message: 'A aprovacao da conta ainda esta pendente.',
        code: 'ACCOUNT_PENDING_APPROVAL',
      });
      return;
    }

    if (loginResult.status === 'inactive_account') {
      res.status(403).json({
        message: 'A conta encontra-se desativada.',
        code: 'ACCOUNT_INACTIVE',
      });
      return;
    }

    res.status(200).json(loginResult.account);
  } catch {
    res.status(500).json({ message: 'Failed to login.' });
  }
};

export const recoverPassword = async (req, res) => {
  const { email } = req.body ?? {};

  if (!email) {
    res.status(400).json({ message: 'Email is required.' });
    return;
  }

  try {
    const accountData = await authService.recoverPassword(email);
    if (!accountData) {
      res.status(404).json({ message: 'Email not found.' });
      return;
    }

    res.status(200).json({ accountId: accountData.id });
  } catch {
    res.status(500).json({ message: 'Failed to recover password.' });
  }
};

export const resetPassword = async (req, res) => {
  const { email, newPassword } = req.body ?? {};

  if (!email || !newPassword) {
    res.status(400).json({ message: 'Email and new password are required.' });
    return;
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    res.status(400).json({ message: 'Password must be at least 6 characters.' });
    return;
  }

  try {
    const account = await authService.resetPassword(email, newPassword);
    if (!account) {
      res.status(404).json({ message: 'Email not found.' });
      return;
    }

    res.status(200).json(account);
  } catch {
    res.status(500).json({ message: 'Failed to reset password.' });
  }
};

export const changePassword = async (req, res) => {
  const { accountId, currentPassword, newPassword } = req.body ?? {};

  if (!accountId || !currentPassword || !newPassword) {
    res.status(400).json({ message: 'Missing required fields.' });
    return;
  }

  try {
    await authService.changePassword({ accountId, currentPassword, newPassword });
    res.status(200).json({ updated: true });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ message: error?.message || 'Failed to update password.' });
  }
};

export const listServiceLines = async (_req, res) => {
  try {
    const data = await authService.listServiceLines();
    res.status(200).json(data);
  } catch {
    res.status(500).json({ message: 'Failed to load service lines.' });
  }
};

export const listAdminUsers = async (req, res) => {
  const tab = String(req.query?.tab || 'users');
  const search = String(req.query?.search || '');
  const accountType = String(req.query?.accountType || 'all');

  try {
    const data = await authService.listAdminUsers({ tab, search, accountType });
    res.status(200).json(data);
  } catch {
    res.status(500).json({ message: 'Failed to load users.' });
  }
};

export const createAdminUser = async (req, res) => {
  const { nome, email, senha, roles, serviceLineIds } = req.body ?? {};

  if (!nome || !email || !senha) {
    res.status(400).json({ message: 'Missing required fields.' });
    return;
  }

  try {
    const created = await authService.createAdminUser({
      nome,
      email,
      senha,
      roles,
      serviceLineIds,
    });
    res.status(201).json(created);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ message: error?.message || 'Failed to create user.' });
  }
};

export const updateAdminUserPermissions = async (req, res) => {
  const accountId = Number(req.params?.accountId);
  const { roles, serviceLineIds } = req.body ?? {};

  if (!accountId || !Array.isArray(roles) || roles.length === 0) {
    res.status(400).json({ message: 'Missing required fields.' });
    return;
  }

  try {
    const updated = await authService.updateAdminUserPermissions(accountId, { roles, serviceLineIds });
    res.status(200).json(updated);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ message: error?.message || 'Failed to update permissions.' });
  }
};

export const updateAdminUserStatus = async (req, res) => {
  const accountId = Number(req.params?.accountId);
  const status = String(req.body?.status || '').trim().toLowerCase();

  if (!accountId || !status) {
    res.status(400).json({ message: 'Missing required fields.' });
    return;
  }

  try {
    const updated = await authService.updateAdminUserStatus(accountId, { status });
    res.status(200).json(updated);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ message: error?.message || 'Failed to update status.' });
  }
};

export const decidePendingUser = async (req, res) => {
  const accountId = Number(req.params?.accountId);
  const decision = String(req.body?.decision || '').trim().toLowerCase();

  if (!accountId || !decision) {
    res.status(400).json({ message: 'Missing required fields.' });
    return;
  }

  try {
    const updated = await authService.decidePendingUser(accountId, { decision });
    res.status(200).json(updated);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ message: error?.message || 'Failed to process decision.' });
  }
};

export const listRgpdTopics = async (_req, res) => {
  try {
    const rows = await RgpdTopico.findAll({
      order: [['ordem', 'ASC'], ['nrgpd', 'ASC']],
    });

    const topics = (rows || []).map((row) => ({
      id: Number(row?.nrgpd),
      title: row?.titulo || '',
      body: row?.corpo || '',
      order: Number(row?.ordem) || 0,
    }));

    res.status(200).json(topics);
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch RGPD topics.' });
  }
};
