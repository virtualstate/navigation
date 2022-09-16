import type { Navigation } from "./spec/navigation";

export let globalNavigation: Navigation | undefined = undefined;
if (typeof window !== "undefined" && window.navigation) {
    const navigation = window.navigation;
    assert(navigation);
    globalNavigation = navigation;
}

function assert(value: unknown): asserts value is Navigation {
    if (!value) {
        throw new Error("Expected Navigation");
    }
}