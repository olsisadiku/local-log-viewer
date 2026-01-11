import { useEffect, useRef, useCallback } from 'react';
import type { ServerMessage, ClientMessage } from '@docker-log-viewer/shared';
import { useLogStore } from '../stores/logStore';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const {
    addLog,
    addLogs,
    clearLogs,
    addService,
    setServices,
    setConnected,
  } = useLogStore();

  const connect = useCallback(() => {
    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Send subscribe message
      const msg: ClientMessage = { type: 'subscribe' };
      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'init':
            // Convert timestamp strings back to Date objects
            const logsWithDates = message.logs.map(log => ({
              ...log,
              timestamp: log.timestamp ? new Date(log.timestamp) : null,
            }));
            addLogs(logsWithDates);
            setServices(message.services);
            break;

          case 'log':
            const logWithDate = {
              ...message.entry,
              timestamp: message.entry.timestamp ? new Date(message.entry.timestamp) : null,
            };
            addLog(logWithDate);
            break;

          case 'batch':
            const batchWithDates = message.entries.map(log => ({
              ...log,
              timestamp: log.timestamp ? new Date(log.timestamp) : null,
            }));
            addLogs(batchWithDates);
            break;

          case 'service-discovered':
            addService(message.service);
            break;

          case 'clear':
            clearLogs();
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;

      // Attempt reconnect after 2 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [addLog, addLogs, addService, clearLogs, setConnected, setServices]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { sendMessage };
}
