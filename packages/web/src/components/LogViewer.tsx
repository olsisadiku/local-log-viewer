import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLogStore } from '../stores/logStore';
import { LogRow } from './LogRow';

export function LogViewer() {
  const parentRef = useRef<HTMLDivElement>(null);
  const {
    getPaginatedLogs,
    autoScroll,
    setAutoScroll,
    currentPage,
    pageSize,
    setPageSize,
    nextPage,
    prevPage,
    goToLastPage,
    setCurrentPage,
  } = useLogStore();

  const { logs, totalPages, totalLogs } = getPaginatedLogs();

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 20,
  });

  // Auto-scroll to bottom when new logs arrive and on last page
  useEffect(() => {
    if (autoScroll && logs.length > 0 && currentPage === totalPages) {
      virtualizer.scrollToIndex(logs.length - 1, { align: 'end' });
    }
  }, [logs.length, autoScroll, virtualizer, currentPage, totalPages]);

  // Auto-go to last page when autoScroll is on and new logs arrive
  useEffect(() => {
    if (autoScroll && currentPage !== totalPages && totalPages > 0) {
      goToLastPage();
    }
  }, [autoScroll, totalPages, currentPage, goToLastPage]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!parentRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    if (autoScroll && !isAtBottom && currentPage === totalPages) {
      setAutoScroll(false);
    } else if (!autoScroll && isAtBottom && currentPage === totalPages) {
      setAutoScroll(true);
    }
  };

  if (totalLogs === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-4 font-mono">[]</div>
          <p className="text-lg">Waiting for logs...</p>
          <p className="text-sm mt-2 text-gray-600">
            Pipe Docker Compose output to start viewing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Pagination controls */}
      <div className="flex-none flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalLogs)} of {totalLogs.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Per page:</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="First page"
          >
            ««
          </button>
          <button
            onClick={prevPage}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-sm text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={nextPage}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            onClick={goToLastPage}
            disabled={currentPage === totalPages}
            className="px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Last page"
          >
            »»
          </button>
        </div>
      </div>

      {/* Log list */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const log = logs[virtualRow.index];
            const globalIndex = ((currentPage - 1) * pageSize) + virtualRow.index;
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <LogRow log={log} index={globalIndex} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
