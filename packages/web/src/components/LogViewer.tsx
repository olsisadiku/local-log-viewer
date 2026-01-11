import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLogStore } from '../stores/logStore';
import { LogRow } from './LogRow';

export function LogViewer() {
  const parentRef = useRef<HTMLDivElement>(null);
  const { getFilteredLogs, autoScroll, setAutoScroll } = useLogStore();

  const logs = getFilteredLogs();

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28, // Estimated row height
    overscan: 20,
  });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logs.length > 0) {
      virtualizer.scrollToIndex(logs.length - 1, { align: 'end' });
    }
  }, [logs.length, autoScroll, virtualizer]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!parentRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    if (autoScroll && !isAtBottom) {
      setAutoScroll(false);
    } else if (!autoScroll && isAtBottom) {
      setAutoScroll(true);
    }
  };

  if (logs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-4">[]</div>
          <p>Waiting for logs...</p>
          <p className="text-sm mt-2">
            Pipe Docker Compose output to start viewing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto"
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
              <LogRow log={log} index={virtualRow.index} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
