import { URLPattern as polyfillURLPattern } from "urlpattern-polyfill";
import {globalURLPattern, URLPatternInit} from "./url-pattern-global";
import {URLPatternResult} from "./types";
import {Event} from "../event-target";
import {compositeKey} from "@virtualstate/composite-key";

export { URLPatternInit } from "./url-pattern-global";

export class URLPattern extends (globalURLPattern ?? polyfillURLPattern) implements polyfillURLPattern {

}

export function isURLPatternStringWildcard(pattern: string): pattern is "*" {
    return pattern === "*";
}

const patternSymbols = Object.values({
    // From https://wicg.github.io/urlpattern/#parsing-patterns
    open: "{",
    close: "}",
    regexpOpen: "(",
    regexpClose: ")",
    nameStart: ":",
    asterisk: "*"
} as const);

export const patternParts = [
    "protocol",
    "hostname",
    "username",
    "password",
    "port",
    "pathname",
    "search",
    "hash"
] as const;

export function isURLPatternStringPlain(pattern: string) {
    for (const symbol of patternSymbols) {
        if (pattern.includes(symbol)) {
            return false;
        }
    }
    return true;
}

export function isURLPatternPlainPathname(pattern: URLPattern) {
    if (!isURLPatternStringPlain(pattern.pathname)) {
        return false;
    }
    for (const part of patternParts) {
        if (part === "pathname") continue;
        if (!isURLPatternStringWildcard(pattern[part])) {
            return false;
        }
    }
    return true;
}

type CompositeObjectKey = Readonly<{ __proto__: null }>;

// Note, this weak map will contain all urls
// matched in the current process.
// This may not be wanted by everyone
let execCache: WeakMap<CompositeObjectKey, false | URLPatternResult> | undefined = undefined;

export function enableURLPatternCache() {
    execCache = execCache ?? new WeakMap();
}

export function exec(pattern: URLPattern, url: URL): URLPatternResult | undefined {
    if (!execCache) {
        return pattern.exec(url);
    }
    const key = compositeKey(
        pattern,
        ...patternParts
            .filter(part => !isURLPatternStringWildcard(pattern[part]))
            .map(part => url[part])
    );
    const existing = execCache.get(key);
    if (existing) return existing;
    if (existing === false) return undefined;
    const result = pattern.exec(url);
    execCache.set(key, result ?? false);
    return result;
}