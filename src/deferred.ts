export interface Deferred<T = void> {
  resolve(value: T): void;
  reject(reason: unknown): void;
  promise: Promise<T>;
}

export function deferred<T = void>(): Deferred<T> {
  let resolve: Deferred<T>["resolve"] | undefined = undefined,
    reject: Deferred<T>["reject"] | undefined = undefined;
  const promise = new Promise<T>(
    (resolveFn, rejectFn) => {
      resolve = resolveFn;
      reject = rejectFn;
    }
  );
  ok(resolve);
  ok(reject);
  return {
    resolve,
    reject,
    promise
  };
}

function ok(value: unknown): asserts value {
  if (!value) {
    throw new Error("Value not provided");
  }
}
