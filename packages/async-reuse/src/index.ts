/**
 * Lifecycle state of an {@link AsyncReuse} instance.
 */
export enum AsyncReuseState {
  idle = "idle",
  loading = "loading",
  resolved = "resolved",
  rejected = "rejected",
}

/**
 * Single-owner promise with idempotent settle. Late settles are ignored so a
 * superseded execution can never overwrite newer state.
 */
class Deferred<T> {
  readonly promise: Promise<T>;
  private settled = false;
  private doResolve!: (value: T) => void;
  private doReject!: (reason: unknown) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.doResolve = resolve;
      this.doReject = reject;
    });
  }

  resolve(value: T): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.doResolve(value);
  }

  reject(reason: unknown): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.doReject(reason);
  }
}

/**
 * Deduplicate concurrent async operations and reuse resolved results.
 *
 * One instance tracks one operation at a time (single-task). Callers with the
 * same `key` share one execution and receive the very same promise; a
 * different `key` starts a new execution that supersedes the previous one.
 * Superseded holders still settle with their own outcome, but they no longer
 * drive instance state.
 *
 * @example
 * const users = new AsyncReuse<User>();
 * const a = users.resolve(() => fetchUser(id), `user:${id}`);
 * const b = users.resolve(() => fetchUser(id), `user:${id}`);
 * // a === b, fetcher ran once
 */
export class AsyncReuse<T = void> {
  protected state: AsyncReuseState = AsyncReuseState.idle;
  protected deferred: Deferred<T> | null = null;
  protected resolvedAt = 0;

  key = "";
  duration = 0;
  expiresAt = 0;

  constructor(value?: T | null) {
    if (value !== undefined && value !== null) {
      const deferred = new Deferred<T>();
      deferred.resolve(value);
      this.deferred = deferred;
      this.state = AsyncReuseState.resolved;
      this.resolvedAt = Date.now();
    }
  }

  get isExpired(): boolean {
    if (this.duration > 0 && this.resolvedAt > 0) {
      if (Date.now() > this.resolvedAt + this.duration) {
        return true;
      }
    }
    return this.expiresAt > 0 && Date.now() > this.expiresAt;
  }

  /**
   * Drop tracked state. An in-flight execution keeps running, its holders
   * reject with an "AsyncReuse reset" error, and its late settlement is
   * ignored.
   */
  reset(): void {
    const dropped = this.deferred;
    this.markIdle();
    this.rejectDropped(dropped, new Error("AsyncReuse reset"));
  }

  /**
   * Run `fetcher` unless the same `key` already has an in-flight or fresh
   * result, and return the shared promise (same reference for same key).
   */
  resolve(fetcher: () => Promise<T>, key = ""): Promise<T> {
    if (this.isExpired) {
      const dropped = this.deferred;
      this.markExpired();
      this.rejectDropped(dropped, new Error("AsyncReuse expired"));
    }

    if (this.deferred && this.key === key) {
      return this.deferred.promise;
    }

    return this.execute(fetcher, key);
  }

  /**
   * Always run `fetcher`, superseding any in-flight or cached result.
   * Previous holders still settle with their own outcome.
   */
  forceResolve(fetcher: () => Promise<T>, key = ""): Promise<T> {
    return this.execute(fetcher, key);
  }

  protected execute(fetcher: () => Promise<T>, key = ""): Promise<T> {
    const current = new Deferred<T>();
    this.markLoading(current, key);

    let outcome: Promise<T>;
    try {
      outcome = fetcher();
    } catch (err) {
      current.reject(err);
      if (this.deferred === current) {
        this.markRejected();
      }
      return current.promise;
    }

    outcome.then(
      (data) => {
        if (this.deferred !== current) {
          current.resolve(data);
          return;
        }
        this.markResolved();
        current.resolve(data);
      },
      (err: unknown) => {
        current.reject(err);
        if (this.deferred !== current) {
          return;
        }
        this.markRejected();
      },
    );
    // Every execution settles exactly one shared promise that callers may
    // drop; keep a silent observer so a dropped failure is never unhandled.
    // Holders still observe the outcome on their own reference.
    current.promise.catch(() => undefined);
    return current.promise;
  }

  protected rejectDropped(deferred: Deferred<T> | null, reason: unknown): void {
    if (!deferred) {
      return;
    }
    deferred.reject(reason);
    // The dropped promise may have no other holders; swallow it here so a
    // reset/expire never surfaces as an unhandled rejection. Existing
    // holders still observe the rejection on their own reference.
    deferred.promise.catch(() => undefined);
  }

  protected markLoading(deferred: Deferred<T>, key: string): void {
    this.state = AsyncReuseState.loading;
    this.deferred = deferred;
    this.key = key;
    this.resolvedAt = 0;
  }

  protected markResolved(): void {
    this.state = AsyncReuseState.resolved;
    this.resolvedAt = Date.now();
  }

  protected markRejected(): void {
    this.state = AsyncReuseState.rejected;
    this.deferred = null;
    this.resolvedAt = 0;
  }

  protected markIdle(): void {
    this.state = AsyncReuseState.idle;
    this.deferred = null;
    this.resolvedAt = 0;
    this.key = "";
  }

  protected markExpired(): void {
    this.state = AsyncReuseState.idle;
    this.deferred = null;
    this.resolvedAt = 0;
    if (this.expiresAt > 0 && this.expiresAt < Date.now()) {
      this.expiresAt = 0;
    }
  }

  /**
   * Latest settled value, or `null` when idle, loading without a result yet,
   * or rejected. Never throws.
   */
  async value(): Promise<T | null> {
    if (!this.deferred) {
      return null;
    }
    try {
      return await this.deferred.promise;
    } catch {
      return null;
    }
  }

  setDuration(ms: number): this {
    this.duration = ms;
    return this;
  }

  setExpiresAt(timestamp: number): this {
    this.expiresAt = timestamp;
    return this;
  }

  get loading(): boolean {
    return this.state === AsyncReuseState.loading;
  }

  get resolved(): boolean {
    return this.state === AsyncReuseState.resolved;
  }

  get rejected(): boolean {
    return this.state === AsyncReuseState.rejected;
  }

  get completed(): boolean {
    return this.resolved || this.rejected;
  }
}
