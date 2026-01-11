import type { LogLevel } from '@docker-log-viewer/shared';
import { useLogStore } from '../stores/logStore';

const LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'TRACE'];

const levelButtonStyles: Record<LogLevel, { active: string; inactive: string }> = {
  DEBUG: {
    active: 'bg-gray-600 text-gray-100 border-gray-500',
    inactive: 'bg-gray-800 text-gray-500 border-gray-700 hover:bg-gray-700',
  },
  INFO: {
    active: 'bg-blue-600 text-white border-blue-500',
    inactive: 'bg-gray-800 text-blue-400 border-gray-700 hover:bg-gray-700',
  },
  WARN: {
    active: 'bg-amber-600 text-white border-amber-500',
    inactive: 'bg-gray-800 text-amber-400 border-gray-700 hover:bg-gray-700',
  },
  ERROR: {
    active: 'bg-red-600 text-white border-red-500',
    inactive: 'bg-gray-800 text-red-400 border-gray-700 hover:bg-gray-700',
  },
  FATAL: {
    active: 'bg-red-700 text-white border-red-600',
    inactive: 'bg-gray-800 text-red-300 border-gray-700 hover:bg-gray-700',
  },
  TRACE: {
    active: 'bg-violet-600 text-white border-violet-500',
    inactive: 'bg-gray-800 text-violet-400 border-gray-700 hover:bg-gray-700',
  },
};

export function FilterBar() {
  const { selectedLevels, toggleLevel } = useLogStore();

  return (
    <div className="flex-none bg-gray-900/50 border-b border-gray-800 px-4 py-2">
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">Log Level:</span>
        <div className="flex gap-1">
          {LEVELS.map((level) => {
            const isActive = selectedLevels.has(level);
            const styles = levelButtonStyles[level];

            return (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                  isActive ? styles.active : styles.inactive
                }`}
              >
                {level}
              </button>
            );
          })}
        </div>
        {selectedLevels.size > 0 && (
          <button
            onClick={() => {
              LEVELS.forEach((level) => {
                if (selectedLevels.has(level)) {
                  toggleLevel(level);
                }
              });
            }}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
