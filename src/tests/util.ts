/* c8 ignore start */
import { getConfig } from "./config";
import { Navigation } from "../spec/navigation";

export function ok(value: unknown, message?: string) {
  assert<unknown>(value, message);
}

export function assert<T>(
  value: unknown,
  message?: string
): asserts value is T {
  if (!value) throw new Error(message);
}

export function debug(...messages: unknown[]) {
  if (getConfig().FLAGS?.includes("DEBUG")) {
    console.log(...messages);
  }
}

// declare global {
//   const navigation: Navigation;
// }

export function isWindowNavigation(navigation: Navigation): boolean {
  return typeof window !== "undefined" && window.navigation === navigation;
}
