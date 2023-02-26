/* c8 ignore start */
import { Navigation } from "../spec/navigation";
import {ok} from "../is";

declare var navigation: Navigation;

ok(navigation, "Expected navigation to be in scope");
//
// if (typeof navigation !== "undefined") {
//   try {
//     function getNavigationByScope() {
//       return navigation;
//     }
//     const fn: NavigationAssertFn = await assertNavigation(getNavigationByScope);
//     fn(getNavigationByScope);
//     console.log("PASS assertNavigation:scope:new Navigation");
//   } catch (error) {
//     console.log("FAIL assertNavigation:scope:new Navigation");
//     throw error;
//   }
// }

console.log("We have navigation in scope");

// In these tests, we are testing either a polyfill that we assume
// has been fully integrated with window.history,
// Or, we have a real navigation implementation
//
// Either way, we could test it using our other tests, but they were
// written to assume they are in isolated situations, that don't cross network
// boundaries. Meaning some unintentionally create network requests too,
// which is fine for those tests when using the in memory implementation, but
// not for the real implementation
//
// If we have an implementation in scope, we just want to assert that the external
// interface matches mostly with what we expect, and if we intercept everything
// correctly, we can test the navigation itself :)
//
//
// We will be testing the actual functionality of navigation in other tests after these
// assertions, so don't worry too much about that
//
// Do try and test in here the parts of the polyfill that integrate with the window and
// elements.
//
// Though we should try and replicate these tests using something like EventTarget with
// some shimming of the objects

ok(navigation.entries(), "Expected entries");
ok(Array.isArray(navigation.entries()), "Expected entries to be an array");
ok(navigation.entries().length, "Expected an entry");
ok(navigation.currentEntry, "Expected a currentEntry");
ok(navigation.currentEntry.key, "Expected currentEntry.key");
ok(typeof navigation.canGoBack === "boolean", "Expected canGoBack to be a boolean");
ok(typeof navigation.canGoForward === "boolean", "Expected canGoForward to be a boolean");

assertFn(navigation.addEventListener);
assertFn(navigation.removeEventListener);
assertFn(navigation.currentEntry.addEventListener);
assertFn(navigation.currentEntry.removeEventListener);
assertFn(navigation.navigate);
assertFn(navigation.traverseTo);
assertFn(navigation.forward);
assertFn(navigation.back);
assertFn(navigation.updateCurrentEntry);
assertFn(navigation.reload);

console.log("Scope navigation passed assertions");

export default 1;

function assertFn(value: unknown): asserts value is Function {
    ok(typeof value === "function", "Expected function")
}