import { useLogStore } from '../stores/logStore';

export function StatusBar() {
  const { logs, getFilteredLogs, autoScroll, setAutoScroll, selectedServices, selectedLevels, searchQuery } = useLogStore();

  const filteredLogs = getFilteredLogs();
  const isFiltered = selectedServices.size > 0 || selectedLevels.size > 0 || searchQuery;

  return (
    <footer className="flex-none bg-gray-900 border-t border-gray-800 px-4 py-1.5 text-xs text-gray-400">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span>
            {isFiltered
              ? `Showing ${filteredLogs.length.toLocaleString()} of ${logs.length.toLocaleString()} logs`
              : `${logs.length.toLocaleString()} logs`}
          </span>
          {searchQuery && (
            <span className="text-blue-400">
              Search: "{searchQuery}"
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors ${
              autoScroll
                ? 'bg-blue-900/50 text-blue-400'
                : 'bg-gray-800 text-gray-500 hover:text-gray-300'
            }`}
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
            Auto-scroll {autoScroll ? 'ON' : 'OFF'}
          </button>

          <span className="text-gray-600">
            Press <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">/</kbd> to search
          </span>
        </div>
      </div>
    </footer>
  );
}
