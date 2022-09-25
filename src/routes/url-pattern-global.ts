import type {URLPattern as URLPatternPolyfill} from "urlpattern-polyfill";

export interface URLPatternInit {
    baseURL?: string;
    username?: string;
    password?: string;
    protocol?: string;
    hostname?: string;
    port?: string;
    pathname?: string;
    search?: string;
    hash?: string;
}

declare var URLPattern: {
    new (init?: URLPatternInit | string, baseURL?: string): URLPatternPolyfill;
};

export const globalURLPattern = typeof URLPattern === "undefined" ? undefined : URLPattern;