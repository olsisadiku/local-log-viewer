import { memo } from 'react';
import type { LogEntry, LogLevel } from '@docker-log-viewer/shared';
import { format } from 'date-fns';
import { useLogStore } from '../stores/logStore';

interface LogRowProps {
  log: LogEntry;
  index: number;
}

const levelStyles: Record<LogLevel, string> = {
  DEBUG: 'log-level-debug',
  INFO: 'log-level-info',
  WARN: 'log-level-warn',
  ERROR: 'log-level-error',
  FATAL: 'log-level-fatal',
  TRACE: 'log-level-trace',
};

// Generate consistent colors for services
function getServiceColor(service: string): string {
  const colors = [
    'bg-blue-900/40 text-blue-400',
    'bg-green-900/40 text-green-400',
    'bg-purple-900/40 text-purple-400',
    'bg-pink-900/40 text-pink-400',
    'bg-cyan-900/40 text-cyan-400',
    'bg-orange-900/40 text-orange-400',
    'bg-teal-900/40 text-teal-400',
    'bg-indigo-900/40 text-indigo-400',
  ];

  let hash = 0;
  for (let i = 0; i < service.length; i++) {
    hash = (hash << 5) - hash + service.charCodeAt(i);
    hash |= 0;
  }

  return colors[Math.abs(hash) % colors.length];
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));

  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <span key={i} className="highlight">
        {part}
      </span>
    ) : (
      part
    )
  );
}

export const LogRow = memo(function LogRow({ log, index }: LogRowProps) {
  const searchQuery = useLogStore((s) => s.searchQuery);

  const formattedTime = log.timestamp
    ? format(log.timestamp, 'HH:mm:ss.SSS')
    : '--:--:--.---';

  const serviceColor = getServiceColor(log.service);

  return (
    <div className="log-row flex items-start gap-2 px-4 py-0.5 border-b border-gray-800/50">
      {/* Line number */}
      <span className="flex-none w-12 text-right text-gray-600 select-none">
        {index + 1}
      </span>

      {/* Timestamp */}
      <span className="flex-none w-24 text-gray-500 font-mono text-xs">
        {formattedTime}
      </span>

      {/* Service badge */}
      <span
        className={`flex-none w-28 truncate px-2 py-0.5 rounded text-xs font-medium ${serviceColor}`}
        title={log.service}
      >
        {log.service}
      </span>

      {/* Level badge */}
      <span className="flex-none w-14">
        {log.level && (
          <span className={`log-level-badge ${levelStyles[log.level]}`}>
            {log.level}
          </span>
        )}
      </span>

      {/* Message */}
      <span className="flex-1 min-w-0 truncate text-gray-300">
        {highlightText(log.message, searchQuery)}
      </span>
    </div>
  );
});
