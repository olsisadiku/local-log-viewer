#!/usr/bin/env node

import { startLogViewer } from '../index.js';
import type { CLIConfig } from '@docker-log-viewer/shared';
import { DEFAULT_CONFIG } from '@docker-log-viewer/shared';

function printHelp(): void {
  console.log(`
\x1b[1mdocker-log-viewer\x1b[0m - A lightweight log viewer for Docker Compose

\x1b[1mUSAGE:\x1b[0m
  docker compose up | docker-log-viewer [options]
  docker compose up | dlv [options]

\x1b[1mOPTIONS:\x1b[0m
  -p, --port <number>       Port for web UI (default: ${DEFAULT_CONFIG.port})
  -b, --buffer <number>     Max logs in memory (default: ${DEFAULT_CONFIG.bufferSize})
  -r, --retention <number>  Minutes to keep logs (default: ${DEFAULT_CONFIG.retentionMinutes}, 0 = forever)
  -o, --open                Open browser automatically
  -H, --host <string>       Host to bind to (default: ${DEFAULT_CONFIG.host})
  -h, --help                Show this help message
  -v, --version             Show version

\x1b[1mEXAMPLES:\x1b[0m
  docker compose up | dlv
  docker compose up 2>&1 | dlv --port 3000 --open
  docker compose logs -f | dlv --buffer 50000
`);
}

function printVersion(): void {
  console.log('docker-log-viewer v0.1.0');
}

function parseArgs(args: string[]): Partial<CLIConfig> & { help?: boolean; version?: boolean } {
  const config: Partial<CLIConfig> & { help?: boolean; version?: boolean } = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        config.help = true;
        break;
      case '-v':
      case '--version':
        config.version = true;
        break;
      case '-o':
      case '--open':
        config.open = true;
        break;
      case '-p':
      case '--port':
        i++;
        config.port = parseInt(args[i], 10);
        if (isNaN(config.port)) {
          console.error('Error: Invalid port number');
          process.exit(1);
        }
        break;
      case '-b':
      case '--buffer':
        i++;
        config.bufferSize = parseInt(args[i], 10);
        if (isNaN(config.bufferSize)) {
          console.error('Error: Invalid buffer size');
          process.exit(1);
        }
        break;
      case '-H':
      case '--host':
        i++;
        config.host = args[i];
        break;
      case '-r':
      case '--retention':
        i++;
        config.retentionMinutes = parseInt(args[i], 10);
        if (isNaN(config.retentionMinutes)) {
          console.error('Error: Invalid retention value');
          process.exit(1);
        }
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Error: Unknown option: ${arg}`);
          process.exit(1);
        }
    }

    i++;
  }

  return config;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const config = parseArgs(args);

  if (config.help) {
    printHelp();
    process.exit(0);
  }

  if (config.version) {
    printVersion();
    process.exit(0);
  }

  // Check if stdin is a TTY (no piped input)
  if (process.stdin.isTTY) {
    console.log('\x1b[33mWarning:\x1b[0m No piped input detected.');
    console.log('Usage: docker compose up | docker-log-viewer');
    console.log('');
    console.log('Starting server anyway. You can pipe logs later or paste them directly.');
    console.log('');
  }

  await startLogViewer(config);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
