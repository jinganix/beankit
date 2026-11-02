interface PromiseWithResolversCapability<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export class Deferred<T = void> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly reject: (reason?: unknown) => void;

  constructor() {
    // `Promise.withResolvers` is ES2024 and missing from the ES2023 lib
    // types, so detect it structurally and fall back on older runtimes.
    // Keep the method call on `Promise`: the native function requires
    // a constructor as its receiver.
    const scope = Promise as unknown as {
      withResolvers?<U>(): PromiseWithResolversCapability<U>;
    };

    if (typeof scope.withResolvers === "function") {
      const deferred = scope.withResolvers<T>();
      this.promise = deferred.promise;
      this.resolve = deferred.resolve;
      this.reject = deferred.reject;
      return;
    }

    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    this.promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.resolve = resolve;
    this.reject = reject;
  }
}
