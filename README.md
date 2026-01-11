# Docker Log Viewer

A lightweight, real-time log viewer for Docker Compose with ELK-like features. View, filter, and search your container logs in a beautiful web interface.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)

## Features

- **Real-time streaming** - Logs appear instantly as they're generated
- **Service filtering** - Show/hide logs from specific containers
- **Log level filtering** - Filter by DEBUG, INFO, WARN, ERROR, etc.
- **Full-text search** - Search through all your logs with highlighting
- **Virtual scrolling** - Handle thousands of logs without lag
- **Auto-scroll** - Follows new logs with smart pause on manual scroll
- **Color-coded** - Services and log levels are color-coded for easy scanning
- **Keyboard shortcuts** - Press `/` to search, `Escape` to clear

## Installation

```bash
# Using npx (no install needed)
docker compose up | npx docker-log-viewer

# Or install globally
npm install -g docker-log-viewer
docker compose up | dlv
```

## Usage

Pipe your Docker Compose output to the log viewer:

```bash
# Basic usage
docker compose up | dlv

# Include stderr (recommended)
docker compose up 2>&1 | dlv

# With options
docker compose up 2>&1 | dlv --port 3000 --open

# Follow existing logs
docker compose logs -f | dlv
```

Then open http://localhost:4000 in your browser.

## CLI Options

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port <number>` | 4000 | Port for the web UI |
| `-b, --buffer <number>` | 10000 | Maximum logs to keep in memory |
| `-o, --open` | false | Open browser automatically |
| `-H, --host <string>` | localhost | Host to bind to |
| `-h, --help` | | Show help |
| `-v, --version` | | Show version |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search box |
| `Escape` | Clear search and unfocus |

## How It Works

```
docker compose up
       |
       v (stdout)
   docker-log-viewer CLI
       |
       +---> Parses log lines (service, timestamp, level, message)
       +---> Stores in ring buffer (default 10k lines)
       +---> Serves web UI on localhost
       +---> Broadcasts logs via WebSocket
       |
       v
   Browser (React + Virtual Scrolling)
```

The CLI:
1. Reads log lines from stdin
2. Parses Docker Compose format to extract service name, timestamp, log level, and message
3. Stores logs in a memory-efficient ring buffer
4. Serves a React web UI and streams logs via WebSocket

The web UI:
1. Connects to the CLI's WebSocket server
2. Receives logs in real-time
3. Renders with virtual scrolling for performance
4. Provides filtering and search capabilities

## Development

```bash
# Clone the repo
git clone https://github.com/yourusername/docker-log-viewer.git
cd docker-log-viewer

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Development (in separate terminals)
cd packages/web && pnpm dev    # Vite dev server
cd packages/cli && pnpm dev    # CLI with hot reload
```

## Project Structure

```
docker-log-viewer/
├── packages/
│   ├── cli/          # CLI tool (Node.js)
│   ├── web/          # React web UI
│   └── shared/       # Shared types
└── ...
```

## Tech Stack

- **CLI**: Node.js, WebSocket (ws)
- **Web**: React 18, Vite, TailwindCSS, Zustand, @tanstack/react-virtual

## License

MIT
