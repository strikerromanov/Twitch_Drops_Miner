import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { apiRouter } from './api/routes';
import { config } from './core/config';
import { logInfo, logError, logWarn, logDebug } from './core/logger';
import { initDb, closeDb } from './core/database';
import { DropIndexerService } from './services/drop-indexer.service';
import { PointClaimerService } from './services/point-claimer.service';
import { ChatFarmerService } from './services/chat-farmer.service';
import { FollowedChannelsService } from './services/followed-channels.service';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// EXPRESS APP SETUP
// ============================================

const app: Express = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logDebug('API Request', {
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  next();
});

// ============================================
// WEBSOCKET SERVER
// ============================================

const wss = new WebSocketServer({ server, path: '/ws' });

const wsClients: Set<WebSocket> = new Set();

wss.on('connection', (ws: WebSocket) => {
  logInfo('WebSocket client connected');
  wsClients.add(ws);

  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      logDebug('WebSocket message received', { type: message.type });
      
      // Broadcast to other clients
      wsClients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    } catch (error) {
      logError('WebSocket message parse error', {}, error as Error);
    }
  });

  ws.on('close', () => {
    logInfo('WebSocket client disconnected');
    wsClients.delete(ws);
  });

  ws.on('error', (error) => {
    logError('WebSocket error', {}, error as Error);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection',
    status: 'connected',
    timestamp: new Date().toISOString()
  }));
});

// Broadcast function for services to use
export function broadcastToClients(data: any) {
  const message = JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// ============================================
// API ROUTES
// ============================================

app.use('/api', apiRouter);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// STATIC FILE SERVING
// ============================================

app.use(express.static(path.join(__dirname, '../dist')));

app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logError('Express error', {
    method: req.method,
    url: req.url,
    error: err.message
  }, err);
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================
// SERVICE INSTANCES
// ============================================

let dropIndexer: DropIndexerService | null = null;
let pointClaimer: PointClaimerService | null = null;
let chatFarmer: ChatFarmerService | null = null;
let followedChannels: FollowedChannelsService | null = null;

// ============================================
// STARTUP
// ============================================

async function startServer() {
  try {
    logInfo('Starting Twitch Drops Miner...', { port: config.PORT });

    // Initialize database
    initDb();
    logInfo('Database initialized');

    // Start services
    dropIndexer = new DropIndexerService();
    dropIndexer.start();
    logInfo('Drop Indexer Service started');

    pointClaimer = new PointClaimerService();
    pointClaimer.start();
    logInfo('Point Claimer Service started');

    chatFarmer = new ChatFarmerService();
    chatFarmer.start();
    logInfo('Chat Farmer Service started');

    followedChannels = new FollowedChannelsService();
    followedChannels.start();
    logInfo('Followed Channels Service started');

    // Start HTTP server
    server.listen(config.PORT, () => {
      logInfo('Server listening', {
        port: config.PORT,
        env: process.env.NODE_ENV || 'development'
      });
    });

  } catch (error) {
    logError('Failed to start server', {}, error as Error);
    process.exit(1);
  }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function shutdown() {
  logInfo('Shutting down gracefully...');

  // Stop services
  if (dropIndexer) {
    dropIndexer.stop();
    logInfo('Drop Indexer Service stopped');
  }

  if (pointClaimer) {
    pointClaimer.stop();
    logInfo('Point Claimer Service stopped');
  }

  if (chatFarmer) {
    chatFarmer.stop();
    logInfo('Chat Farmer Service stopped');
  }

  if (followedChannels) {
    followedChannels.stop();
    logInfo('Followed Channels Service stopped');
  }

  // Close WebSocket connections
  wsClients.forEach(client => {
    client.close();
  });
  logInfo('WebSocket connections closed');

  // Close HTTP server
  server.close(() => {
    logInfo('HTTP server closed');
  });

  // Close database
  closeDb();
  logInfo('Database connection closed');

  logInfo('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('uncaughtException', (error) => {
  logError('Uncaught exception', {}, error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled rejection', { reason }, reason as Error);
});

// ============================================
// START
// ============================================

startServer();
