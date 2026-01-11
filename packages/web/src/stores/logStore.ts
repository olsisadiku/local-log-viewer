import { create } from 'zustand';
import type { LogEntry, LogLevel } from '@docker-log-viewer/shared';

interface LogState {
  logs: LogEntry[];
  services: string[];

  // Filters
  selectedServices: Set<string>;
  selectedLevels: Set<LogLevel>;
  searchQuery: string;

  // Pagination
  pageSize: number;
  currentPage: number;

  // UI state
  isConnected: boolean;
  autoScroll: boolean;

  // Actions
  addLog: (entry: LogEntry) => void;
  addLogs: (entries: LogEntry[]) => void;
  clearLogs: () => void;
  addService: (service: string) => void;
  setServices: (services: string[]) => void;

  toggleService: (service: string) => void;
  toggleLevel: (level: LogLevel) => void;
  selectAllServices: () => void;
  deselectAllServices: () => void;
  setSearchQuery: (query: string) => void;

  setConnected: (connected: boolean) => void;
  setAutoScroll: (autoScroll: boolean) => void;

  // Pagination actions
  setPageSize: (size: number) => void;
  setCurrentPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  goToLastPage: () => void;

  // Computed
  getFilteredLogs: () => LogEntry[];
  getPaginatedLogs: () => { logs: LogEntry[]; totalPages: number; totalLogs: number };
}

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  services: [],

  selectedServices: new Set<string>(),
  selectedLevels: new Set<LogLevel>(),
  searchQuery: '',

  pageSize: 100,
  currentPage: 1,

  isConnected: false,
  autoScroll: true,

  addLog: (entry) => {
    set((state) => ({
      logs: [...state.logs, entry],
    }));

    // Auto-add service if new
    const { services, addService } = get();
    if (!services.includes(entry.service)) {
      addService(entry.service);
    }
  },

  addLogs: (entries) => {
    set((state) => ({
      logs: [...state.logs, ...entries],
    }));

    // Auto-add services
    const { services, setServices } = get();
    const newServices = new Set(services);
    entries.forEach(e => newServices.add(e.service));
    if (newServices.size > services.length) {
      setServices(Array.from(newServices));
    }
  },

  clearLogs: () => set({ logs: [] }),

  addService: (service) => {
    set((state) => ({
      services: state.services.includes(service)
        ? state.services
        : [...state.services, service].sort(),
    }));
  },

  setServices: (services) => set({ services: services.sort() }),

  toggleService: (service) => {
    set((state) => {
      const newSelected = new Set(state.selectedServices);
      if (newSelected.has(service)) {
        newSelected.delete(service);
      } else {
        newSelected.add(service);
      }
      return { selectedServices: newSelected };
    });
  },

  toggleLevel: (level) => {
    set((state) => {
      const newSelected = new Set(state.selectedLevels);
      if (newSelected.has(level)) {
        newSelected.delete(level);
      } else {
        newSelected.add(level);
      }
      return { selectedLevels: newSelected };
    });
  },

  selectAllServices: () => {
    set((state) => ({
      selectedServices: new Set(state.services),
    }));
  },

  deselectAllServices: () => set({ selectedServices: new Set() }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setConnected: (connected) => set({ isConnected: connected }),

  setAutoScroll: (autoScroll) => set({ autoScroll }),

  setPageSize: (size) => set({ pageSize: size, currentPage: 1 }),

  setCurrentPage: (page) => set({ currentPage: page }),

  nextPage: () => {
    const { currentPage, getPaginatedLogs } = get();
    const { totalPages } = getPaginatedLogs();
    if (currentPage < totalPages) {
      set({ currentPage: currentPage + 1 });
    }
  },

  prevPage: () => {
    const { currentPage } = get();
    if (currentPage > 1) {
      set({ currentPage: currentPage - 1 });
    }
  },

  goToLastPage: () => {
    const { getPaginatedLogs } = get();
    const { totalPages } = getPaginatedLogs();
    set({ currentPage: totalPages });
  },

  getFilteredLogs: () => {
    const { logs, selectedServices, selectedLevels, searchQuery } = get();

    return logs.filter((log) => {
      // Service filter (empty = show all)
      if (selectedServices.size > 0 && !selectedServices.has(log.service)) {
        return false;
      }

      // Level filter (empty = show all)
      if (selectedLevels.size > 0 && log.level && !selectedLevels.has(log.level)) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesMessage = log.message.toLowerCase().includes(query);
        const matchesService = log.service.toLowerCase().includes(query);
        const matchesLogger = log.logger?.toLowerCase().includes(query);
        if (!matchesMessage && !matchesService && !matchesLogger) {
          return false;
        }
      }

      return true;
    });
  },

  getPaginatedLogs: () => {
    const { getFilteredLogs, pageSize, currentPage } = get();
    const filtered = getFilteredLogs();
    const totalLogs = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalLogs / pageSize));
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const logs = filtered.slice(start, end);

    return { logs, totalPages, totalLogs };
  },
}));
