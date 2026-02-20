import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

import { config } from './config/index.js';
import { db } from './db/connection.js';
import { logger } from './utils/logger.js';
import { apiRouter } from './api/index.js';
import { setupWebSocket } from './websocket/index.js';
import { loadXpConfig } from './xp/xp-config.js';
import { startAilmentTicker } from './utils/ailment-ticker.js';

const app: Express = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new SocketServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: config.websocket.heartbeatInterval,
  pingTimeout: config.websocket.reconnectTimeout,
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: config.server.isDev ? false : undefined,
}));

app.use(cors({
  origin: '*',
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'blackfyre-hud-backend',
  });
});

// API routes
app.use('/api', apiRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: config.server.isDev ? err.message : 'Internal server error',
  });
});

// Startup
async function start(): Promise<void> {
  try {
    // Initialize database
    await db.init();

    // Load XP configuration into memory cache
    await loadXpConfig();

    // Setup WebSocket handlers
    setupWebSocket(io);

    // Start ailment ticker (wound infection onset, terminal/immunity clocks, self-heal — every 60s)
    startAilmentTicker();

    // Start server
    httpServer.listen(config.server.port, config.server.host, () => {
      logger.info(`🚀 Blackfyre HUD Backend running at http://${config.server.host}:${config.server.port}`);
      logger.info(`📡 WebSocket server ready`);
      logger.info(`📊 Environment: ${config.server.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  io.close(() => {
    logger.info('WebSocket server closed');
  });

  await db.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the server
start();

export { app, io };
