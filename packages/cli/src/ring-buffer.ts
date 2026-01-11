import type { LogEntry } from '@docker-log-viewer/shared';

export class RingBuffer {
  private buffer: LogEntry[];
  private head: number = 0;
  private tail: number = 0;
  private count: number = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(entry: LogEntry): LogEntry | null {
    let evicted: LogEntry | null = null;

    if (this.count === this.capacity) {
      // Buffer is full, we'll overwrite the oldest entry
      evicted = this.buffer[this.head];
      this.head = (this.head + 1) % this.capacity;
    } else {
      this.count++;
    }

    this.buffer[this.tail] = entry;
    this.tail = (this.tail + 1) % this.capacity;

    return evicted;
  }

  toArray(): LogEntry[] {
    if (this.count === 0) return [];

    const result: LogEntry[] = [];
    let index = this.head;

    for (let i = 0; i < this.count; i++) {
      result.push(this.buffer[index]);
      index = (index + 1) % this.capacity;
    }

    return result;
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    this.buffer = new Array(this.capacity);
  }

  get size(): number {
    return this.count;
  }

  get maxSize(): number {
    return this.capacity;
  }
}
