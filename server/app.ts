import express from 'express';
import cors from 'cors';
import { config } from './infra/config.js';
import { logger } from './infra/logger.js';
import { errorHandler } from './infra/error-handler.js';
import { requestIdMiddleware, requestLogMiddleware } from './infra/request-context.js';
import { createUserController } from './modules/user/controller.js';
import { createVenueController } from './modules/venue/controller.js';
import { createNotificationController } from './modules/notification/controller.js';
import { createActivityController } from './modules/activity/controller.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(requestIdMiddleware);
app.use(requestLogMiddleware);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Mount module routes
app.use('/api', createUserController());
app.use('/api', createVenueController());
app.use('/api', createNotificationController());
app.use('/api', createActivityController());
// TODO: Mount remaining module routes here
// app.use('/api', coachingRoutes);
// app.use('/api', matchRecordRoutes);
// app.use('/api', reviewRoutes);

// Error handler (must be last)
app.use(errorHandler);

const port = config.port;

app.listen(port, () => {
  logger.info({ port }, `Server is running on port ${port}`);
});

export default app;
