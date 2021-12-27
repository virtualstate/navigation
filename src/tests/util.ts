/* c8 ignore start */
import {getConfig} from "./config";
import {AppHistory} from "../spec/app-history";

export function ok(value: unknown) {
    assert<unknown>(value);
}

export function assert<T>(value: unknown, message?: string): asserts value is T {
    if (!value) throw new Error(message);
}

export function debug(...messages: unknown[]) {
    if (getConfig().FLAGS?.includes("DEBUG")) {
        console.log(...messages);
    }
}

declare global {
    const appHistory: AppHistory;
}

export function isWindowAppHistory(appHistory: AppHistory): boolean {
    return typeof window !== "undefined" && window.appHistory === appHistory;
}