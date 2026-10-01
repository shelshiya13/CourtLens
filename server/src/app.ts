import express from 'express';
import cookieParser from 'cookie-parser';
import { authenticate } from './auth/middleware.js';
import { authRouter } from './auth/routes.js';
import { casesRouter } from './cases/routes.js';
import { documentsRouter } from './documents/routes.js';
import { evidenceRouter } from './evidence/routes.js';
import { dashboardRouter } from './dashboard/routes.js';
import { notificationsRouter } from './notifications/routes.js';
import { jobsRouter } from './jobs/routes.js';
import { systemRouter } from './system/routes.js';

export function createExpressApp() {
  const app = express();

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use(cookieParser());
  app.use(authenticate);

  // Health probe
  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/cases', casesRouter);
  app.use('/api/cases', documentsRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api', evidenceRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/guardian', dashboardRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/system', systemRouter);
  app.use('/api', systemRouter);

  return app;
}
