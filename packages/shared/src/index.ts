export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'TRACE';

export interface LogEntry {
  id: string;
  raw: string;
  timestamp: Date | null;
  service: string;
  level: LogLevel | null;
  message: string;
  logger?: string;
}

export interface FilterState {
  services: string[];
  levels: LogLevel[];
  search: string;
  timeRange: {
    start: Date | null;
    end: Date | null;
  };
}

// WebSocket message types
export type ServerMessage =
  | { type: 'init'; logs: LogEntry[]; services: string[] }
  | { type: 'log'; entry: LogEntry }
  | { type: 'batch'; entries: LogEntry[] }
  | { type: 'service-discovered'; service: string }
  | { type: 'clear' }
  | { type: 'pong' };

export type ClientMessage =
  | { type: 'subscribe' }
  | { type: 'ping' }
  | { type: 'clear' };

// CLI configuration
export interface CLIConfig {
  port: number;
  bufferSize: number;
  open: boolean;
  host: string;
}

export const DEFAULT_CONFIG: CLIConfig = {
  port: 4000,
  bufferSize: 10000,
  open: false,
  host: 'localhost',
};
