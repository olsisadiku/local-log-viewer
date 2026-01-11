import { useEffect, useRef } from 'react';
import type { ServerMessage, ClientMessage, LogEntry } from '@docker-log-viewer/shared';
import { useLogStore } from '../stores/logStore';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function connect() {
      // Determine WebSocket URL based on current location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}`;

      console.log('[WebSocket] Connecting to', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        useLogStore.getState().setConnected(true);
        // Send subscribe message
        const msg: ClientMessage = { type: 'subscribe' };
        ws.send(JSON.stringify(msg));
      };

      ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          const state = useLogStore.getState();

          switch (message.type) {
            case 'init':
              console.log('[WebSocket] Received init with', message.logs.length, 'logs');
              const logsWithDates = message.logs.map((log: LogEntry) => ({
                ...log,
                timestamp: log.timestamp ? new Date(log.timestamp) : null,
              }));
              state.addLogs(logsWithDates);
              state.setServices(message.services);
              break;

            case 'log':
              console.log('[WebSocket] Received log:', message.entry.service);
              const logWithDate = {
                ...message.entry,
                timestamp: message.entry.timestamp ? new Date(message.entry.timestamp) : null,
              };
              state.addLog(logWithDate);
              break;

            case 'batch':
              console.log('[WebSocket] Received batch with', message.entries.length, 'logs');
              const batchWithDates = message.entries.map((log: LogEntry) => ({
                ...log,
                timestamp: log.timestamp ? new Date(log.timestamp) : null,
              }));
              state.addLogs(batchWithDates);
              break;

            case 'service-discovered':
              console.log('[WebSocket] New service:', message.service);
              state.addService(message.service);
              break;

            case 'clear':
              state.clearLogs();
              break;
          }
        } catch (e) {
          console.error('[WebSocket] Parse error:', e);
        }
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected, reconnecting in 2s...');
        useLogStore.getState().setConnected(false);
        wsRef.current = null;

        // Attempt reconnect after 2 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2000);
      };

      ws.onerror = (e) => {
        console.error('[WebSocket] Error:', e);
        ws.close();
      };
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const sendMessage = (message: ClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  return { sendMessage };
}
