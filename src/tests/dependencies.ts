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
        "@virtualstate/app-history/event-target": "https://cdn.skypack.dev/@virtualstate/app-history/event-target/async-event-target",
    }
}));
export const DependenciesHTML = await toString(Dependencies);

export const DependenciesSync = h("script", { type: "importmap" }, h(DependenciesContent, {
    imports: {
        "deno:std@latest": "https://cdn.skypack.dev/@edwardmx/noop",
        "@virtualstate/nop": "https://cdn.skypack.dev/@edwardmx/noop",
        "@virtualstate/app-history/event-target": "https://cdn.skypack.dev/@virtualstate/app-history/event-target/sync-event-target",
    }
}));
export const DependenciesSyncHTML = await toString(DependenciesSync);