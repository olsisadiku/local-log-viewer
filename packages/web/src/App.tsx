import { useWebSocket } from './hooks/useWebSocket';
import { useLogStore } from './stores/logStore';
import { LogViewer } from './components/LogViewer';
import { SearchBar } from './components/SearchBar';
import { FilterBar } from './components/FilterBar';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';

function App() {
  useWebSocket();

  const { isConnected, logs } = useLogStore();

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="flex-none bg-gray-900 border-b border-gray-800 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
              <span className="text-blue-500 font-mono">[]</span>
              Docker Log Viewer
            </h1>
            <SearchBar />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {logs.length.toLocaleString()} logs
            </span>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-400">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Filter bar */}
      <FilterBar />

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <Sidebar />

        {/* Log viewer */}
        <main className="flex-1 min-w-0">
          <LogViewer />
        </main>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}

export default App;
