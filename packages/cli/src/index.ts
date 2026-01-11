import readline from 'node:readline';
import type { CLIConfig } from '@docker-log-viewer/shared';
import { DEFAULT_CONFIG } from '@docker-log-viewer/shared';
import { parseLine } from './parser.js';
import { LogServer } from './server.js';

export { parseLine, parseLines } from './parser.js';
export { LogDatabase } from './database.js';
export { LogServer } from './server.js';

export async function startLogViewer(config: Partial<CLIConfig> = {}): Promise<void> {
  const finalConfig: CLIConfig = { ...DEFAULT_CONFIG, ...config };

  const server = new LogServer(finalConfig);
  await server.start();

  console.log(`\x1b[32m[docker-log-viewer]\x1b[0m Server running at ${server.url}`);
  console.log(`\x1b[32m[docker-log-viewer]\x1b[0m Waiting for logs on stdin...`);
  console.log(`\x1b[32m[docker-log-viewer]\x1b[0m Press Ctrl+C to stop\n`);

  // Open browser if requested
  if (finalConfig.open) {
    const open = await import('open');
    await open.default(server.url);
  }

  // Read from stdin
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  rl.on('line', (line) => {
    // Echo the line to stdout so the user still sees it
    console.log(line);

    // Parse and send to server
    const entry = parseLine(line);
    server.addLog(entry);
  });

  rl.on('close', () => {
    console.log('\n\x1b[32m[docker-log-viewer]\x1b[0m Stdin closed. Server still running.');
    console.log('\x1b[32m[docker-log-viewer]\x1b[0m Press Ctrl+C to stop.');
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\n\x1b[32m[docker-log-viewer]\x1b[0m Shutting down...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
