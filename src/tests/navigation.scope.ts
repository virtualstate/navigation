/* c8 ignore start */
import {NavigateEvent, Navigation} from "../spec/navigation";
import {like, ok} from "../is";
import {EventCallback, EventTarget} from "../event-target";
import {Navigation as NavigationPolyfill, NavigationSetCurrentKey, NavigationSetEntries} from "../navigation";

declare var navigation: Navigation;

if (typeof window !== "undefined") {
    await assertNavigationWithWindow(window, navigation);
}

export async function assertNavigationWithWindow(window: Window, navigation: Navigation) {
    const document = window.document;

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

    console.log(`Is polyfill? ${isNavigationPolyfill(navigation)}`)

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

    class EventCollection<T extends EventTarget> {

        handlers = new Map<string | symbol, Set<Function>>()
        target: T;
        addEventListener: T["addEventListener"];

        constructor(target: T) {
            this.target = target;
            this.addEventListener = (...args) => {
                const [type, callback, options] = args;
                this.target.addEventListener(type, callback, options);
                const set = this.handlers.get(type) ?? new Set();
                set.add(callback);
                this.handlers.set(type, set);
            }
        }


        // removeEventListener(...args: Parameters<T["removeEventListener"]>): void {
        //
        // }

        removeEventListeners() {
            for (const [type, listeners] of this.handlers.entries()) {
                for (const listener of listeners) {
                    this.target.removeEventListener(type, listener);
                }
            }
            this.handlers.clear()
        }

    }

    const collection = new EventCollection(navigation);

    try {

        let eventReceivedAtLeastOnce = false,
            interceptReceivedAtLeastOnce = false,
            interceptAssertedAtLeastOnce = false,
            error = undefined

        // Default intercept to make sure no navigation happens
        // This will by default prevent any anchor clicks from
        // completing by default
        collection.addEventListener("navigate", event => {
            eventReceivedAtLeastOnce = true;
            const { currentEntry: { key: currentKey } } = navigation;
            event.intercept({
                async handler() {
                    interceptReceivedAtLeastOnce = true;
                    try {
                        ok(currentKey, "Expected current entry key");
                        ok(navigation.transition.from.key, "Expected from key");
                        ok(navigation.transition.from.key === currentKey, "Expected current entry to match transition.from.key");
                        interceptAssertedAtLeastOnce = true;
                    } catch (caught) {
                        error = caught;
                    }
                }
            });
        });

        // Hopefully our window has a document
        ok(document);

        const anchor = document.createElement("a");

        const randomUrl = `/random/${Math.random()}`;
        anchor.href = randomUrl;
        anchor.download = `named-${Math.random()}.png`;
        anchor.id = "test-click-me";

        const anchorPromise = new Promise<NavigateEvent>(
            resolve => {
                collection.addEventListener(
                    "navigate",
                    event => {
                        if (new URL(event.destination.url).pathname === randomUrl) {
                            resolve(event);
                        }
                    }
                )
            }
        );

        document.body.appendChild(anchor);

        anchor.click();

        const anchorEvent = await anchorPromise;

        ok<NavigateEvent>(anchorEvent);

        console.log("Anchor event seen:", anchorEvent.type, anchorEvent.originalEvent?.type, anchorEvent.destination.url);

        document.body.removeChild(anchor);

        const form = document.createElement("form");

        form.method = Math.random() > 0.5 ? "post" : "get";
        const expectedActionPathname = `/action/${Math.random()}`
        form.action = expectedActionPathname;

        console.log("Expected pathname", expectedActionPathname);

        const inputA = document.createElement("input");
        const inputB = document.createElement("input");
        const inputC = document.createElement("input");
        const inputD = document.createElement("input");

        inputA.name = "a";
        inputB.name = "b";
        inputC.name = "c";
        inputD.name = "d";

        inputA.value = `${Math.random()} A`
        inputB.value = `${Math.random()} B`
        inputC.value = `${Math.random()} C`
        inputD.value = `${Math.random()} D`

        form.appendChild(inputA);
        form.appendChild(inputB);
        form.appendChild(inputC);
        form.appendChild(inputD);

        const submitButton = document.createElement("button")
        submitButton.type = "submit";
        submitButton.formAction = expectedActionPathname;
        form.appendChild(submitButton);

        document.body.appendChild(form);

        const formPromise = new Promise<NavigateEvent>(
            resolve => {
                collection.addEventListener(
                    "navigate",
                    event => {
                        // console.log("Seen event", event.destination.url);
                        if (new URL(event.destination.url).pathname === expectedActionPathname) {
                            resolve(event);
                        } else {
                            console.log("Not match", new URL(event.destination.url).pathname, expectedActionPathname)
                        }
                    }
                )
            }
        );

        document.body.appendChild(form);

        console.log("form submit")
        submitButton.click();

        const formEvent = await formPromise;

        console.log("Form event seen:", formEvent.type, formEvent.originalEvent?.type, formEvent.formData, formEvent.destination.url);

        document.body.removeChild(form);

        ok(eventReceivedAtLeastOnce, "Expected navigation event");
        ok(interceptReceivedAtLeastOnce, "Expected navigation event intercept");
        ok(interceptAssertedAtLeastOnce, error ?? "Expected navigation event intercept to have passed");
    } finally {



        // Remove from global navigation when done
        collection.removeEventListeners();
    }
}


export default 1;

function assertFn(value: unknown): asserts value is Function {
    ok(typeof value === "function", "Expected function")
}

function isNavigationPolyfill(navigation?: Navigation): navigation is NavigationPolyfill {
    return (
        like<NavigationPolyfill>(navigation) &&
        typeof navigation[NavigationSetEntries] === "function" &&
        typeof navigation[NavigationSetCurrentKey] === "function"
    )
}