import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import type { LogEntry, ServerMessage, ClientMessage, CLIConfig } from '@docker-log-viewer/shared';
import { LogDatabase, QueryOptions } from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export class LogServer {
  private httpServer: http.Server;
  private wss: WebSocketServer;
  private db: LogDatabase;
  private services: Set<string> = new Set();
  private clients: Set<WebSocket> = new Set();
  private config: CLIConfig;
  private publicDir: string;

  constructor(config: CLIConfig) {
    this.config = config;
    this.db = new LogDatabase(config.retentionMinutes);
    this.publicDir = path.join(__dirname, 'public');

    this.httpServer = http.createServer(this.handleHttpRequest.bind(this));
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    let urlPath = url.pathname;

    // API endpoints
    if (urlPath.startsWith('/api/')) {
      this.handleApiRequest(req, res, url);
      return;
    }

    // Default to index.html
    if (urlPath === '/') {
      urlPath = '/index.html';
    }

    const filePath = path.join(this.publicDir, urlPath);
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Security: prevent directory traversal
    if (!filePath.startsWith(this.publicDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          if (!ext) {
            fs.readFile(path.join(this.publicDir, 'index.html'), (err2, indexData) => {
              if (err2) {
                res.writeHead(404);
                res.end('Not Found');
              } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(indexData);
              }
            });
          } else {
            res.writeHead(404);
            res.end('Not Found');
          }
        } else {
          res.writeHead(500);
          res.end('Internal Server Error');
        }
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  }

  private handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.writeHead(204);
      res.end();
      return;
    }

    const endpoint = url.pathname.replace('/api/', '');

    switch (endpoint) {
      case 'query':
        this.handleQuery(url, res);
        break;
      case 'stats':
        this.handleStats(res);
        break;
      case 'services':
        this.handleServices(res);
        break;
      default:
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  private handleQuery(url: URL, res: http.ServerResponse): void {
    const params = url.searchParams;
    const options: QueryOptions = {
      search: params.get('search') || undefined,
      services: params.get('services')?.split(',').filter(Boolean) || undefined,
      levels: params.get('levels')?.split(',').filter(Boolean) as any || undefined,
      startTime: params.get('startTime') ? new Date(params.get('startTime')!) : undefined,
      endTime: params.get('endTime') ? new Date(params.get('endTime')!) : undefined,
      limit: params.get('limit') ? parseInt(params.get('limit')!, 10) : 100,
      offset: params.get('offset') ? parseInt(params.get('offset')!, 10) : 0,
    };

    try {
      const result = this.db.query(options);
      res.writeHead(200);
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Query failed' }));
    }
  }

  private handleStats(res: http.ServerResponse): void {
    try {
      const stats = this.db.getStats();
      res.writeHead(200);
      res.end(JSON.stringify(stats));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Stats failed' }));
    }
  }

  private handleServices(res: http.ServerResponse): void {
    try {
      const services = this.db.getServices();
      res.writeHead(200);
      res.end(JSON.stringify({ services }));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Services failed' }));
    }
  }

  private handleConnection(ws: WebSocket): void {
    this.clients.add(ws);

    // Send initial state with recent logs from database
    const logs = this.db.getRecentLogs(500);
    const initMessage: ServerMessage = {
      type: 'init',
      logs,
      services: Array.from(this.services),
    };
    ws.send(JSON.stringify(initMessage));

    ws.on('message', (data) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        this.handleClientMessage(ws, message);
      } catch {
        // Ignore invalid messages
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
    });

    ws.on('error', () => {
      this.clients.delete(ws);
    });
  }

  private handleClientMessage(ws: WebSocket, message: ClientMessage): void {
    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' } as ServerMessage));
        break;
      case 'clear':
        this.db.clear();
        this.broadcast({ type: 'clear' });
        break;
    }
  }

  private broadcast(message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  addLog(entry: LogEntry): void {
    // Store in database
    this.db.addLog(entry);

    // Track new services
    if (!this.services.has(entry.service)) {
      this.services.add(entry.service);
      this.broadcast({ type: 'service-discovered', service: entry.service });
    }

    // Broadcast to connected clients
    this.broadcast({ type: 'log', entry });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.config.port, this.config.host, () => {
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const client of this.clients) {
        client.close();
      }
      this.wss.close();
      this.db.close();
      this.httpServer.close(() => resolve());
    });
  }

  get url(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }
}
