/** Minimal FIFO semaphore: at most `limit` holders at once. */
export class Semaphore {
  private active = 0;
  private readonly queue: (() => void)[] = [];

  constructor(readonly limit: number) {}

  get running(): number {
    return this.active;
  }

  get waiting(): number {
    return this.queue.length;
  }

  /** Resolves with a release function once a slot is free. */
  acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const grant = () => {
        this.active++;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.active--;
          this.queue.shift()?.();
        });
      };
      if (this.active < this.limit) grant();
      else this.queue.push(grant);
    });
  }
}
