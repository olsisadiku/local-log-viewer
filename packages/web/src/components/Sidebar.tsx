import { useLogStore } from '../stores/logStore';

// Generate consistent colors for services (same as LogRow)
function getServiceColor(service: string): string {
  const colors = [
    'bg-blue-900/40 text-blue-400 border-blue-800',
    'bg-green-900/40 text-green-400 border-green-800',
    'bg-purple-900/40 text-purple-400 border-purple-800',
    'bg-pink-900/40 text-pink-400 border-pink-800',
    'bg-cyan-900/40 text-cyan-400 border-cyan-800',
    'bg-orange-900/40 text-orange-400 border-orange-800',
    'bg-teal-900/40 text-teal-400 border-teal-800',
    'bg-indigo-900/40 text-indigo-400 border-indigo-800',
  ];

  let hash = 0;
  for (let i = 0; i < service.length; i++) {
    hash = (hash << 5) - hash + service.charCodeAt(i);
    hash |= 0;
  }

  return colors[Math.abs(hash) % colors.length];
}

export function Sidebar() {
  const {
    services,
    selectedServices,
    toggleService,
    selectAllServices,
    deselectAllServices,
    logs,
  } = useLogStore();

  // Count logs per service
  const serviceCounts = services.reduce<Record<string, number>>((acc, service) => {
    acc[service] = logs.filter((log) => log.service === service).length;
    return acc;
  }, {});

  if (services.length === 0) {
    return (
      <aside className="w-56 flex-none bg-gray-900/30 border-r border-gray-800 p-4">
        <h2 className="text-sm font-medium text-gray-400 mb-3">Services</h2>
        <p className="text-sm text-gray-500">No services detected</p>
      </aside>
    );
  }

  return (
    <aside className="w-56 flex-none bg-gray-900/30 border-r border-gray-800 overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-400">Services</h2>
          <div className="flex gap-2">
            <button
              onClick={selectAllServices}
              className="text-xs text-gray-500 hover:text-gray-300"
              title="Select all"
            >
              All
            </button>
            <button
              onClick={deselectAllServices}
              className="text-xs text-gray-500 hover:text-gray-300"
              title="Clear selection"
            >
              None
            </button>
          </div>
        </div>

        <div className="space-y-1">
          {services.map((service) => {
            const isSelected =
              selectedServices.size === 0 || selectedServices.has(service);
            const serviceColor = getServiceColor(service);
            const count = serviceCounts[service] || 0;

            return (
              <button
                key={service}
                onClick={() => toggleService(service)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                  isSelected
                    ? serviceColor
                    : 'bg-gray-800/50 text-gray-500 border-gray-700'
                } border`}
              >
                <span className="truncate">{service}</span>
                <span className="text-xs opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
