export interface Clock {
  now(): Date;
  sleep(ms: number): Promise<void>;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

interface Sleeper {
  wake_at: number;
  seq: number;
  resolve: () => void;
}

// Test clock: time moves only through advance(); sleepers resolve inside advance, never on a timer.
export class FakeClock implements Clock {
  private current_ms: number;
  private sleepers: Sleeper[] = [];
  private next_seq = 0;

  constructor(start: Date = new Date("2026-01-01T00:00:00.000Z")) {
    this.current_ms = start.getTime();
  }

  now(): Date {
    return new Date(this.current_ms);
  }

  advance(ms: number): void {
    this.current_ms += ms;
    const due = this.sleepers
      .filter((s) => s.wake_at <= this.current_ms)
      .sort((a, b) => a.wake_at - b.wake_at || a.seq - b.seq);
    this.sleepers = this.sleepers.filter((s) => s.wake_at > this.current_ms);
    for (const s of due) s.resolve();
  }

  sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.sleepers.push({ wake_at: this.current_ms + ms, seq: this.next_seq++, resolve });
    });
  }
}
