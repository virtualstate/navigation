/* c8 ignore start */
import { DefaultImportMap } from "./dependencies-input";

export interface DependenciesContentOptions {
  imports?: Record<string, string>;
}

export const DependenciesJSON = {
  imports: {
    ...DefaultImportMap,
    "urlpattern-polyfill": "https://cdn.skypack.dev/urlpattern-polyfill@v8.0.2",
    "deno:std@latest": "https://cdn.skypack.dev/@edwardmx/noop",
    "@virtualstate/nop": "https://cdn.skypack.dev/@edwardmx/noop",
    "@virtualstate/navigation/event-target":
      "https://cdn.skypack.dev/@virtualstate/navigation/event-target/async-event-target",
    iterable: "https://cdn.skypack.dev/iterable@6.0.1-beta.5",
    "https://cdn.skypack.dev/-/iterable@v5.7.0-CNtyuMJo9f2zFu6CuB1D/dist=es2019,mode=imports/optimized/iterable.js":
      "https://cdn.skypack.dev/iterable@6.0.1-beta.5",
  },
};
export const DependenciesHTML = `<script type="importmap">${JSON.stringify(
  DependenciesJSON,
  undefined,
  "  "
)}</script>`;

export const DependenciesSyncJSON = {
  imports: {
    ...DefaultImportMap,
    "urlpattern-polyfill": "https://cdn.skypack.dev/urlpattern-polyfill@v8.0.2",
    "deno:std@latest": "https://cdn.skypack.dev/@edwardmx/noop",
    "@virtualstate/nop": "https://cdn.skypack.dev/@edwardmx/noop",
    "@virtualstate/navigation/event-target":
      "https://cdn.skypack.dev/@virtualstate/navigation/event-target/sync-event-target",
    iterable: "https://cdn.skypack.dev/iterable@6.0.1-beta.5",
    "https://cdn.skypack.dev/-/iterable@v5.7.0-CNtyuMJo9f2zFu6CuB1D/dist=es2019,mode=imports/optimized/iterable.js":
      "https://cdn.skypack.dev/iterable@6.0.1-beta.5",
  },
};
export const DependenciesSyncHTML = `<script type="importmap">${JSON.stringify(
  DependenciesSyncJSON,
  undefined,
  "  "
)}</script>`;
