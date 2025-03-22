import "urlpattern-polyfill";
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

if (typeof URLPattern === "undefined") {
    throw new Error("urlpattern-polyfill did not import correctly");
}

export const globalURLPattern = URLPattern;