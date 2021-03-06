/* c8 ignore start */
export const DefaultDependencies = [
  "@opennetwork/http-representation",
  "@virtualstate/astro-renderer",
  "@virtualstate/dom",
  "@virtualstate/examples",
  "@virtualstate/fringe",
  "@virtualstate/kdl",
  "@virtualstate/focus",
  "@virtualstate/focus/static-h",
  "@virtualstate/hooks",
  "@virtualstate/hooks-extended",
  "@virtualstate/union",
  "@virtualstate/x",
  "@virtualstate/navigation",
  "@virtualstate/navigation/event-target/sync",
  "@virtualstate/navigation/event-target/async",
  "dom-lite",
  "iterable",
  "uuid",
  "whatwg-url",
  "abort-controller",
  "urlpattern-polyfill"
] as const;
export const DefaultImportMap = Object.fromEntries(
    DefaultDependencies
        .filter((key: string) => typeof key === "string" && key)
        .map((key: string) => [key, `https://cdn.skypack.dev/${key}`])
)

export default DefaultDependencies;