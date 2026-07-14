import cors from 'cors';
import express from 'express';
import { checkToken } from './middleware.js';
import authRoutes from './routes/authRoutes.js';
import announcementRoutes from './routes/announcementRoutes.js';
import adminBadgeRoutes from './routes/adminBadgeRoutes.js';
import adminLearningPathRoutes from './routes/adminLearningPathRoutes.js';
import adminGeneralManagementRoutes from './routes/adminGeneralManagementRoutes.js';
import consultorRoutes from './routes/consultorRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import requestManagementRoutes from './routes/requestManagementRoutes.js';
import serviceLineLeaderRoutes from './routes/serviceLineLeaderRoutes.js';
import talentManagerRoutes from './routes/talentManagerRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import shareRoutes from './routes/shareRoutes.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/admin-gestor/badges', checkToken, adminBadgeRoutes);
app.use('/api/admin-gestor/learning-paths', checkToken, adminLearningPathRoutes);
app.use('/api/admin-gestor/general-management', checkToken, adminGeneralManagementRoutes);
app.use('/api/consultor', consultorRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/service-line-leader', serviceLineLeaderRoutes);
app.use('/api/talent-manager', talentManagerRoutes);
app.use('/api/request-management', requestManagementRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/share', shareRoutes);

export default app;
