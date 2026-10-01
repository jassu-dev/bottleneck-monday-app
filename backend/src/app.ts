import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import prisma from './db/prisma';
import webhookRoutes from './routes/webhookRoutes';
import mondayRoutes from './routes/mondayRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import slaRoutes from './routes/slaRoutes';
import oauthRoutes from './routes/oauthRoutes';
import integrationRoutes from './routes/integrationRoutes';

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/oauth', oauthRoutes);
app.use('/integration', integrationRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/api/monday', mondayRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/slas', slaRoutes);

// Health Check Endpoint
app.get('/health', async (_req: Request, res: Response) => {
  let dbStatus = 'healthy';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = 'unreachable';
  }

  res.status(200).json({
    status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    service: 'bottleneck-backend',
  });
});

app.get('/api', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'Bottleneck: Time in Status & SLAs API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      webhooks: '/webhooks/monday',
      nudge: '/api/monday/nudge',
      analytics: '/api/analytics',
      slas: '/api/slas',
    }
  });
});

export default app;
