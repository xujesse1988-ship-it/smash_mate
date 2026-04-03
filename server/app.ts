import express from 'express';
import cors from 'cors';
import { config } from './infra/config.js';
import { logger } from './infra/logger.js';
import { errorHandler } from './infra/error-handler.js';
import { requestIdMiddleware, requestLogMiddleware } from './infra/request-context.js';

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

// TODO: Mount module routes here
// app.use('/api', userRoutes);
// app.use('/api', activityRoutes);
// app.use('/api', coachingRoutes);
// app.use('/api', matchRecordRoutes);
// app.use('/api', venueRoutes);
// app.use('/api', notificationRoutes);
// app.use('/api', reviewRoutes);

// Error handler (must be last)
app.use(errorHandler);

const port = config.port;

app.listen(port, () => {
  logger.info({ port }, `Server is running on port ${port}`);
});

export default app;
