import Database from 'better-sqlite3';
import type { LogEntry, LogLevel } from '@docker-log-viewer/shared';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

export interface QueryOptions {
  search?: string;
  services?: string[];
  levels?: LogLevel[];
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  logs: LogEntry[];
  total: number;
  services: string[];
  levelCounts: Record<string, number>;
}

export interface LogStats {
  totalLogs: number;
  services: { name: string; count: number }[];
  levels: { level: string; count: number }[];
  logsPerMinute: { minute: string; count: number }[];
}

export class LogDatabase {
  private db: Database.Database;
  private insertStmt: Database.Statement;
  private retentionMinutes: number;

  constructor(retentionMinutes: number = 30) {
    this.retentionMinutes = retentionMinutes;

    // Create database in temp directory
    const dbDir = path.join(os.tmpdir(), 'docker-log-viewer');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, `logs-${Date.now()}.db`);

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.initSchema();
    this.insertStmt = this.db.prepare(`
      INSERT INTO logs (id, raw, timestamp, service, level, message, logger)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Start retention cleanup
    if (retentionMinutes > 0) {
      setInterval(() => this.cleanOldLogs(), 60000);
    }
  }

  private initSchema(): void {
    // Main logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        raw TEXT NOT NULL,
        timestamp INTEGER,
        service TEXT NOT NULL,
        level TEXT,
        message TEXT NOT NULL,
        logger TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_logs_service ON logs(service);
      CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
      CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);
    `);

    // Full-text search virtual table
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS logs_fts USING fts5(
        id,
        message,
        service,
        logger,
        content='logs',
        content_rowid='rowid'
      );

      -- Triggers to keep FTS index in sync
      CREATE TRIGGER IF NOT EXISTS logs_ai AFTER INSERT ON logs BEGIN
        INSERT INTO logs_fts(rowid, id, message, service, logger)
        VALUES (NEW.rowid, NEW.id, NEW.message, NEW.service, NEW.logger);
      END;

      CREATE TRIGGER IF NOT EXISTS logs_ad AFTER DELETE ON logs BEGIN
        INSERT INTO logs_fts(logs_fts, rowid, id, message, service, logger)
        VALUES('delete', OLD.rowid, OLD.id, OLD.message, OLD.service, OLD.logger);
      END;
    `);
  }

  addLog(entry: LogEntry): void {
    this.insertStmt.run(
      entry.id,
      entry.raw,
      entry.timestamp?.getTime() ?? null,
      entry.service,
      entry.level,
      entry.message,
      entry.logger ?? null
    );
  }

  query(options: QueryOptions = {}): QueryResult {
    const { search, services, levels, startTime, endTime, limit = 100, offset = 0 } = options;

    let whereClause = '1=1';
    const params: (string | number)[] = [];

    if (search) {
      // Use FTS5 for full-text search
      whereClause += ` AND logs.id IN (SELECT id FROM logs_fts WHERE logs_fts MATCH ?)`;
      // FTS5 query syntax - search in message, service, logger
      params.push(`"${search.replace(/"/g, '""')}"`);
    }

    if (services && services.length > 0) {
      whereClause += ` AND logs.service IN (${services.map(() => '?').join(',')})`;
      params.push(...services);
    }

    if (levels && levels.length > 0) {
      whereClause += ` AND logs.level IN (${levels.map(() => '?').join(',')})`;
      params.push(...levels);
    }

    if (startTime) {
      whereClause += ` AND logs.timestamp >= ?`;
      params.push(startTime.getTime());
    }

    if (endTime) {
      whereClause += ` AND logs.timestamp <= ?`;
      params.push(endTime.getTime());
    }

    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM logs WHERE ${whereClause}`);
    const { count: total } = countStmt.get(...params) as { count: number };

    // Get logs
    const logsStmt = this.db.prepare(`
      SELECT id, raw, timestamp, service, level, message, logger
      FROM logs
      WHERE ${whereClause}
      ORDER BY timestamp DESC, created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = logsStmt.all(...params, limit, offset) as {
      id: string;
      raw: string;
      timestamp: number | null;
      service: string;
      level: string | null;
      message: string;
      logger: string | null;
    }[];

    const logs: LogEntry[] = rows.map(row => ({
      id: row.id,
      raw: row.raw,
      timestamp: row.timestamp ? new Date(row.timestamp) : null,
      service: row.service,
      level: row.level as LogLevel | null,
      message: row.message,
      logger: row.logger ?? undefined,
    }));

    // Get services
    const servicesStmt = this.db.prepare('SELECT DISTINCT service FROM logs ORDER BY service');
    const servicesRows = servicesStmt.all() as { service: string }[];
    const allServices = servicesRows.map(r => r.service);

    // Get level counts
    const levelStmt = this.db.prepare(`
      SELECT level, COUNT(*) as count FROM logs
      WHERE ${whereClause} AND level IS NOT NULL
      GROUP BY level
    `);
    const levelRows = levelStmt.all(...params) as { level: string; count: number }[];
    const levelCounts: Record<string, number> = {};
    levelRows.forEach(r => { levelCounts[r.level] = r.count; });

    return { logs, total, services: allServices, levelCounts };
  }

  getStats(): LogStats {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM logs');
    const { count: totalLogs } = totalStmt.get() as { count: number };

    const servicesStmt = this.db.prepare(`
      SELECT service as name, COUNT(*) as count
      FROM logs
      GROUP BY service
      ORDER BY count DESC
    `);
    const services = servicesStmt.all() as { name: string; count: number }[];

    const levelsStmt = this.db.prepare(`
      SELECT level, COUNT(*) as count
      FROM logs
      WHERE level IS NOT NULL
      GROUP BY level
      ORDER BY count DESC
    `);
    const levels = levelsStmt.all() as { level: string; count: number }[];

    // Logs per minute for the last 30 minutes
    const logsPerMinuteStmt = this.db.prepare(`
      SELECT
        strftime('%Y-%m-%d %H:%M', datetime(timestamp/1000, 'unixepoch')) as minute,
        COUNT(*) as count
      FROM logs
      WHERE timestamp > ?
      GROUP BY minute
      ORDER BY minute
    `);
    const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
    const logsPerMinute = logsPerMinuteStmt.all(thirtyMinsAgo) as { minute: string; count: number }[];

    return { totalLogs, services, levels, logsPerMinute };
  }

  getServices(): string[] {
    const stmt = this.db.prepare('SELECT DISTINCT service FROM logs ORDER BY service');
    const rows = stmt.all() as { service: string }[];
    return rows.map(r => r.service);
  }

  private cleanOldLogs(): void {
    const cutoff = Date.now() - this.retentionMinutes * 60 * 1000;
    const stmt = this.db.prepare('DELETE FROM logs WHERE created_at < ?');
    const result = stmt.run(cutoff);
    if (result.changes > 0) {
      console.log(`\x1b[33m[docker-log-viewer]\x1b[0m Cleaned ${result.changes} old logs`);
    }
  }

  clear(): void {
    this.db.exec('DELETE FROM logs');
  }

  close(): void {
    this.db.close();
  }

  getRecentLogs(limit: number = 100): LogEntry[] {
    const stmt = this.db.prepare(`
      SELECT id, raw, timestamp, service, level, message, logger
      FROM logs
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as {
      id: string;
      raw: string;
      timestamp: number | null;
      service: string;
      level: string | null;
      message: string;
      logger: string | null;
    }[];

    return rows.reverse().map(row => ({
      id: row.id,
      raw: row.raw,
      timestamp: row.timestamp ? new Date(row.timestamp) : null,
      service: row.service,
      level: row.level as LogLevel | null,
      message: row.message,
      logger: row.logger ?? undefined,
    }));
  }
}
