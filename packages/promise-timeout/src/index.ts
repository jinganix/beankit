export class TimeoutError extends Error {
  override readonly name = "TimeoutError";

  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export interface ClearablePromise<T> extends Promise<T> {
  clear: () => void;
}

export interface PromiseTimeoutOptions<T> {
  milliseconds: number;
  fallback?: () => T | Promise<T>;
  message?: string | Error | false;
  signal?: AbortSignal;
  readonly customTimers?: {
    setTimeout: typeof globalThis.setTimeout;
    clearTimeout: typeof globalThis.clearTimeout;
  };
}

// `setTimeout` stores its delay in a 32-bit signed integer.
const maxDelay = 2 ** 31 - 1;

function abortReason(signal: AbortSignal): unknown {
  return "reason" in signal
    ? signal.reason
    : new DOMException("This operation was aborted.", "AbortError");
}

export function promiseTimeout<T, R = T>(
  input: PromiseLike<T>,
  options: PromiseTimeoutOptions<R> & { message: false },
): ClearablePromise<T | R | undefined>;
export function promiseTimeout<T, R = T>(
  input: PromiseLike<T>,
  options: PromiseTimeoutOptions<R>,
): ClearablePromise<T | R>;
export function promiseTimeout<T, R = T>(
  input: PromiseLike<T>,
  options: PromiseTimeoutOptions<R>,
): ClearablePromise<T | R | undefined> {
  const { milliseconds, fallback, message, signal } = options;
  const { setTimeout: startTimer, clearTimeout: stopTimer } = options.customTimers ?? globalThis;

  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let abortSubscription: { signal: AbortSignal; onAbort: () => void } | undefined;

  // Disarms the timeout timer. The handle is dropped before stopping it so a
  // throwing `clearTimeout` is never retried and cannot resurrect the timer.
  const disarmTimer = (): void => {
    if (timer === undefined) {
      return;
    }
    const handle = timer;
    timer = undefined;
    stopTimer.call(undefined, handle);
  };

  // Stopping the input is best effort: a missing or throwing `.cancel()`
  // must neither change the outcome nor escape as an uncaught exception.
  const cancelInput = (): void => {
    try {
      (input as { cancel?: () => void }).cancel?.();
    } catch {
      // Ignored: the settled outcome matters more than stopping the work.
    }
  };

  const outcome = new Promise<T | R | undefined>((resolve, reject) => {
    const abort = (target: AbortSignal): void => {
      reject(abortReason(target));
      cancelInput();
      // A timeout timer left armed after the abort would keep the runtime awake
      // and call `cancel()` a second time when it fires.
      try {
        disarmTimer();
      } catch {
        // Ignored: the outcome is already decided.
      }
    };

    let invalid: TypeError | undefined;
    if (typeof milliseconds !== "number" || !(milliseconds > 0)) {
      invalid = new TypeError(
        `Expected \`milliseconds\` to be a positive number, got \`${String(milliseconds)}\``,
      );
    } else if (typeof startTimer !== "function" || typeof stopTimer !== "function") {
      invalid = new TypeError(
        "Expected `customTimers` to have a `setTimeout` and a `clearTimeout` function",
      );
    }

    if (invalid !== undefined) {
      reject(invalid);
    } else if (signal !== undefined) {
      // Listen before subscribing: a synchronous thenable can abort the
      // signal from inside `then`, and attaching the listener afterwards
      // would miss the abort and let the timeout wrongly win.
      const onAbort = (): void => {
        abort(signal);
      };
      abortSubscription = { signal, onAbort };
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) {
        abort(signal);
      }
    }

    // The single handler on the input: a rejection arriving after a timeout
    // or an abort is still observed, so it never escapes as unhandled.
    // Bad options and an aborted signal are rejected above, so they win even
    // over an input that settles synchronously.
    input.then(resolve, reject);

    if (invalid !== undefined || signal?.aborted) {
      return;
    }

    // A delay the timer cannot represent never elapses. Without this guard
    // the timer would clamp it and fire at once.
    if (milliseconds > maxDelay) {
      return;
    }

    // Built eagerly so a timeout keeps the caller's stack. Skipped when the
    // timeout cannot reject with it: capturing a stack is expensive and most
    // inputs settle first.
    let timeoutError: TimeoutError | undefined;
    if (fallback === undefined && message !== false && !(message instanceof Error)) {
      timeoutError = new TimeoutError(
        typeof message === "string"
          ? message
          : `Promise timed out after ${milliseconds} milliseconds`,
      );
    }

    const onTimeout = (): void => {
      if (fallback !== undefined) {
        try {
          resolve(fallback());
        } catch (error) {
          reject(error);
        }
      } else if (message === false) {
        resolve(undefined);
      } else if (message instanceof Error) {
        reject(message);
      } else {
        reject(timeoutError);
      }

      cancelInput();
    };

    // Detached call so custom timers with a `this`-dependent
    // implementation keep working.
    timer = startTimer.call(undefined, onTimeout, milliseconds);
  });

  const clearable = outcome.finally(() => {
    // Cleanup runs after the outcome is decided, so a failing step must
    // neither change it nor skip the remaining steps.
    try {
      clearable.clear();
    } catch {
      // Ignored: the handle is left in place so `clear()` can be retried.
    }

    try {
      if (abortSubscription !== undefined) {
        const { signal: target, onAbort } = abortSubscription;
        target.removeEventListener("abort", onAbort);
      }
    } catch {
      // Ignored, for the same reason.
    }
  }) as ClearablePromise<T | R | undefined>;

  clearable.clear = disarmTimer;

  return clearable;
}
