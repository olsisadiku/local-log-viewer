import type { LogEntry, LogLevel } from '@docker-log-viewer/shared';

let idCounter = 0;

// Docker Compose format: "service | rest of log"
const DOCKER_COMPOSE_PATTERN = /^(\S+)\s*\|\s*(.*)$/;

// Common timestamp patterns
const TIMESTAMP_PATTERNS = [
  // [2026-01-11 16:40:38,620] - Kafka style with brackets
  /\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}[,\.]\d+)\]/,
  // 2026-01-11 16:40:38.944 - Spring Boot style
  /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)/,
  // 2026-01-11T16:40:38.944Z - ISO format
  /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/,
];

// Log level pattern - matches common levels
const LEVEL_PATTERN = /\b(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|TRACE)\b/i;

// ANSI escape code pattern
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function stripAnsi(str: string): string {
  return str.replace(ANSI_PATTERN, '');
}

function parseTimestamp(content: string): { timestamp: Date | null; rest: string } {
  for (const pattern of TIMESTAMP_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      const dateStr = match[1].replace(',', '.');
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        // Remove the matched timestamp from the content
        const rest = content.replace(match[0], '').trim();
        return { timestamp: date, rest };
      }
    }
  }
  return { timestamp: null, rest: content };
}

function parseLevel(content: string): { level: LogLevel | null; rest: string } {
  const match = content.match(LEVEL_PATTERN);
  if (match) {
    let levelStr = match[1].toUpperCase();
    // Normalize WARNING to WARN
    if (levelStr === 'WARNING') levelStr = 'WARN';
    const level = levelStr as LogLevel;
    return { level, rest: content };
  }
  return { level: null, rest: content };
}

function extractLogger(content: string): string | undefined {
  // Common patterns for logger names:
  // (kafka.server.BrokerServer)
  // k.c.KafkaConfiguration
  // o.s.b.SpringApplication

  // Pattern 1: Parentheses at end
  const parenMatch = content.match(/\(([a-zA-Z][a-zA-Z0-9.]+)\)\s*$/);
  if (parenMatch) {
    return parenMatch[1];
  }

  // Pattern 2: Abbreviated class name before colon
  const abbrevMatch = content.match(/\s([a-z]\.[a-z]\.[A-Z][a-zA-Z]+)\s*:/);
  if (abbrevMatch) {
    return abbrevMatch[1];
  }

  return undefined;
}

export function parseLine(line: string): LogEntry {
  const raw = line;
  const cleanLine = stripAnsi(line);

  let service = 'unknown';
  let content = cleanLine;

  // Try to extract Docker Compose service name
  const dockerMatch = cleanLine.match(DOCKER_COMPOSE_PATTERN);
  if (dockerMatch) {
    service = dockerMatch[1].trim();
    content = dockerMatch[2].trim();
  }

  // Parse timestamp
  const { timestamp, rest: afterTimestamp } = parseTimestamp(content);

  // Parse log level
  const { level } = parseLevel(afterTimestamp);

  // Extract logger if present
  const logger = extractLogger(afterTimestamp);

  // The message is the content after timestamp extraction
  const message = afterTimestamp;

  return {
    id: `${Date.now()}-${++idCounter}`,
    raw,
    timestamp,
    service,
    level,
    message,
    logger,
  };
}

export function parseLines(input: string): LogEntry[] {
  return input
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(parseLine);
}
