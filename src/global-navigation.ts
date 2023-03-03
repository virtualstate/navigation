import type { Navigation } from "./spec/navigation";

export let globalNavigation: Navigation | undefined = undefined;
if (typeof window !== "undefined" && (window as any).navigation) {
  const navigation = (window as any).navigation;
  assertNavigation(navigation);
  globalNavigation = navigation;
}

function assertNavigation(value: unknown): asserts value is Navigation {
  if (!value) {
    throw new Error("Expected Navigation");
  }
}
