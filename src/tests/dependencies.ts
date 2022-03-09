/* c8 ignore start */

import {h, toString} from "@virtualstate/fringe";

export interface DependenciesContentOptions {
    imports?: Record<string, string>
}

export async function DependenciesContent({ imports }: DependenciesContentOptions) {
    const { default: input } = await import("./dependencies-input");
    return JSON.stringify(
        {
            imports: Object.fromEntries(
                input
                    .filter((key: string) => typeof key === "string" && key)
                    .map((key: string) => [key, `https://cdn.skypack.dev/${key}`])
                    .concat(Object.entries(imports ?? {}))
            )
        }
    );
}

export const Dependencies = h("script", { type: "importmap" }, h(DependenciesContent, {
    imports: {
        "deno:std@latest": "https://cdn.skypack.dev/@edwardmx/noop",
        "@virtualstate/nop": "https://cdn.skypack.dev/@edwardmx/noop",
        "@virtualstate/navigation/event-target": "https://cdn.skypack.dev/@virtualstate/navigation/event-target/async-event-target",
        "iterable": "https://cdn.skypack.dev/iterable@6.0.1-beta.5",
        "https://cdn.skypack.dev/-/iterable@v5.7.0-CNtyuMJo9f2zFu6CuB1D/dist=es2019,mode=imports/optimized/iterable.js": "https://cdn.skypack.dev/iterable@6.0.1-beta.5",
    }
}));
export const DependenciesHTML = await toString(Dependencies);

export const DependenciesSync = h("script", { type: "importmap" }, h(DependenciesContent, {
    imports: {
        "deno:std@latest": "https://cdn.skypack.dev/@edwardmx/noop",
        "@virtualstate/nop": "https://cdn.skypack.dev/@edwardmx/noop",
        "@virtualstate/navigation/event-target": "https://cdn.skypack.dev/@virtualstate/navigation/event-target/sync-event-target",
        "iterable": "https://cdn.skypack.dev/iterable@6.0.1-beta.5",
        "https://cdn.skypack.dev/-/iterable@v5.7.0-CNtyuMJo9f2zFu6CuB1D/dist=es2019,mode=imports/optimized/iterable.js": "https://cdn.skypack.dev/iterable@6.0.1-beta.5",
    }
}));
export const DependenciesSyncHTML = await toString(DependenciesSync);