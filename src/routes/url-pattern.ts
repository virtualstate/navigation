import { URLPattern as polyfillURLPattern } from "urlpattern-polyfill";
import {globalURLPattern, URLPatternInit} from "./url-pattern-global";

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

const patternParts = [
    "username",
    "password",
    "protocol",
    "hostname",
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