import { ok } from "./is";

export type DeferredStatus = "pending" | "fulfilled" | "rejected";

export interface Deferred<T = void> {
  resolve(value: T): void;
  reject(reason: unknown): void;
  promise: Promise<T>;
  readonly settled: boolean;
  readonly status: DeferredStatus;
}

export function defer<T = void>(): Deferred<T> {
  let resolve: Deferred<T>["resolve"] | undefined = undefined,
    reject: Deferred<T>["reject"] | undefined = undefined,
    settled = false,
    status: DeferredStatus = "pending";
  const promise = new Promise<T>((resolveFn, rejectFn) => {
    resolve = (value) => {
      status = "fulfilled";
      settled = true;
      resolveFn(value);
    };
    reject = (reason) => {
      status = "rejected";
      settled = true;
      rejectFn(reason);
    };
  });
  ok(resolve);
  ok(reject);
  return {
    get settled() {
      return settled;
    },
    get status() {
      return status;
    },
    resolve,
    reject,
    promise,
  };
}
