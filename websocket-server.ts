import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import Database from 'better-sqlite3';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

interface ClientInfo {
  ws: WebSocket;
  id: string;
  subscribedChannels: string[];
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientInfo> = new Map();
  private db: Database.Database;
  private broadcastInterval: NodeJS.Timeout | null = null;

  constructor(server: Server, db: Database.Database) {
    this.db = db;
    this.wss = new WebSocketServer({ server, path: '/ws' });
    
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateClientId();
      
      this.clients.set(ws, {
        ws,
        id: clientId,
        subscribedChannels: ['all']
      });

      console.log(`WebSocket client connected: ${clientId}`);

      // Send initial data
      this.sendInitialData(ws);

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log(`WebSocket client disconnected: ${clientId}`);
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });
    });

    // Start periodic broadcasts for updates
    this.startPeriodicBroadcasts();
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async sendInitialData(ws: WebSocket) {
    try {
      const stats = this.db.prepare(`
        SELECT 
          COUNT(DISTINCT account_id) as activeAccounts,
          SUM(followed_channels.points) as totalPoints,
          COUNT(DISTINCT streamer) as activeChannels
        FROM accounts
        JOIN followed_channels ON accounts.id = followed_channels.account_id
        WHERE accounts.status = 'farming'
      `).get() as any;

      const recentClaims = this.db.prepare(`
        SELECT * FROM point_claim_history 
        ORDER BY claimed_at DESC 
        LIMIT 10
      `).all();

      const activeStreams = this.db.prepare(`
        SELECT * FROM active_streams 
        ORDER BY viewer_count DESC 
        LIMIT 20
      `).all();

      this.sendToClient(ws, {
        type: 'initial',
        data: {
          stats: stats || { activeAccounts: 0, totalPoints: 0, activeChannels: 0 },
          recentClaims,
          activeStreams
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending initial data:', error);
    }
  }

  private handleClientMessage(ws: WebSocket, data: any) {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (data.action) {
      case 'subscribe':
        client.subscribedChannels = data.channels || ['all'];
        break;
      case 'ping':
        this.sendToClient(ws, {
          type: 'pong',
          data: { time: new Date().toISOString() },
          timestamp: new Date().toISOString()
        });
        break;
    }
  }

  private startPeriodicBroadcasts() {
    // Broadcast updates every 2 seconds instead of frontend polling every 5 seconds
    this.broadcastInterval = setInterval(() => {
      this.broadcastUpdate();
    }, 2000);
  }

  private broadcastUpdate() {
    const update = this.gatherUpdateData();
    this.broadcast({
      type: 'update',
      data: update,
      timestamp: new Date().toISOString()
    });
  }

  private gatherUpdateData() {
    try {
      // Get latest stats
      const stats = this.db.prepare(`
        SELECT 
          COUNT(DISTINCT account_id) as activeAccounts,
          SUM(followed_channels.points) as totalPoints,
          COUNT(DISTINCT streamer) as activeChannels
        FROM accounts
        JOIN followed_channels ON accounts.id = followed_channels.account_id
        WHERE accounts.status = 'farming'
      `).get() as any;

      // Get recent claims (last 5)
      const recentClaims = this.db.prepare(`
        SELECT * FROM point_claim_history 
        WHERE claimed_at > datetime('now', '-1 minute')
        ORDER BY claimed_at DESC 
        LIMIT 5
      `).all();

      // Get active streams
      const activeStreams = this.db.prepare(`
        SELECT * FROM active_streams 
        ORDER BY viewer_count DESC 
        LIMIT 20
      `).all();

      // Get recent bet results
      const recentBets = this.db.prepare(`
        SELECT * FROM betting_history 
        WHERE bet_time > datetime('now', '-5 minutes')
        ORDER BY bet_time DESC 
        LIMIT 5
      `).all();

      return {
        stats: stats || { activeAccounts: 0, totalPoints: 0, activeChannels: 0 },
        recentClaims,
        activeStreams,
        recentBets
      };
    } catch (error) {
      console.error('Error gathering update data:', error);
      return null;
    }
  }

  // Public methods for broadcasting specific events

  broadcastPointClaim(accountId: number, streamer: string, points: number, bonusType: string) {
    this.broadcast({
      type: 'point_claim',
      data: {
        accountId,
        streamer,
        points,
        bonusType,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }

  broadcastBetResult(accountId: number, streamer: string, outcome: string, points: number) {
    this.broadcast({
      type: 'bet_result',
      data: {
        accountId,
        streamer,
        outcome,
        points,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }

  broadcastStreamStatusChange(streamer: string, status: 'live' | 'offline', viewerCount?: number) {
    this.broadcast({
      type: 'stream_status',
      data: {
        streamer,
        status,
        viewerCount,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }

  broadcastDropProgress(campaignId: string, progress: number, required: number) {
    this.broadcast({
      type: 'drop_progress',
      data: {
        campaignId,
        progress,
        required,
        percentage: (progress / required) * 100,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcast(message: WebSocketMessage) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }

  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  shutdown() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }
    this.wss.close();
  }
}
