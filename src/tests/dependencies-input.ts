/* c8 ignore start */
export const DefaultDependencies = [
  "@opennetwork/http-representation",
  "@virtualstate/astro-renderer",
  "@virtualstate/dom",
  "@virtualstate/examples",
  "@virtualstate/fringe",
  "@virtualstate/promise",
  "@virtualstate/promise/the-thing",
  "@virtualstate/focus",
  "@virtualstate/kdl",
  "@virtualstate/focus",
  "@virtualstate/focus/static-h",
  "@virtualstate/hooks",
  "@virtualstate/hooks-extended",
  "@virtualstate/union",
  "@virtualstate/x",
  "@virtualstate/navigation",
  "@virtualstate/navigation/polyfill",
  "@virtualstate/navigation/event-target/sync",
  "@virtualstate/navigation/event-target/async",
  "@virtualstate/composite-key",
  "dom-lite",
  "iterable",
  "uuid",
  "urlpattern-polyfill",
  "@ungap/structured-clone",
  "@ungap/structured-clone/json"
] as const;
export const DefaultImportMap = Object.fromEntries(
  DefaultDependencies.filter(
    (key: string) => typeof key === "string" && key
  ).map((key: string) => [key, `https://cdn.skypack.dev/${key}`])
);

export default DefaultDependencies;
