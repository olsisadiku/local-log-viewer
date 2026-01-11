import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import type { LogEntry, ServerMessage, ClientMessage, CLIConfig } from '@docker-log-viewer/shared';
import { RingBuffer } from './ring-buffer.js';

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
  private buffer: RingBuffer;
  private services: Set<string> = new Set();
  private clients: Set<WebSocket> = new Set();
  private config: CLIConfig;
  private publicDir: string;

  constructor(config: CLIConfig) {
    this.config = config;
    this.buffer = new RingBuffer(config.bufferSize);
    this.publicDir = path.join(__dirname, 'public');

    this.httpServer = http.createServer(this.handleHttpRequest.bind(this));
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    let urlPath = req.url || '/';

    // Remove query string
    urlPath = urlPath.split('?')[0];

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
          // For SPA routing, serve index.html for non-file routes
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

  private handleConnection(ws: WebSocket): void {
    this.clients.add(ws);

    // Send initial state
    const initMessage: ServerMessage = {
      type: 'init',
      logs: this.buffer.toArray(),
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
        this.buffer.clear();
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
    this.buffer.push(entry);

    // Track new services
    if (!this.services.has(entry.service)) {
      this.services.add(entry.service);
      this.broadcast({ type: 'service-discovered', service: entry.service });
    }

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
      this.httpServer.close(() => resolve());
    });
  }

  get url(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }
}
