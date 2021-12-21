import { ok, assert } from "../util";
import {
    AppHistory,
    AppHistoryCurrentChangeEvent, AppHistoryDestination,
    AppHistoryEntry,
    AppHistoryNavigateEvent
} from "../../app-history.prototype";
import {EventTarget, Event} from "@opennetwork/environment";
import {h, toString, VNode} from "@virtualstate/fringe";

export async function initialNavigateThenBack(appHistory: AppHistory) {
    appHistory.addEventListener("navigate", (event) => {
        event.transitionWhile( new Promise<void>(queueMicrotask));
    }, { once: true });
    const { committed, finished } = appHistory.navigate("/test", {
        state: {
            value: 1
        }
    });
    const committedEntry = await committed;
    const finishedEntry = await finished;

    ok(finishedEntry === appHistory.current);
    ok(committedEntry === finishedEntry);

    if (appHistory.canGoBack) {
        await appHistory.back();
    }
}

export async function routeHandlerExample(appHistory: AppHistory) {

    const routesTable = new Map<string, () => Promise<void>>();

    function handler(event: AppHistoryNavigateEvent) {
        if (!event.canTransition || event.hashChange) {
            return;
        }
        if (routesTable.has(event.destination.url)) {
            const routeHandler = routesTable.get(event.destination.url);
            event.transitionWhile(routeHandler());
        }
    }
    appHistory.addEventListener("navigate", handler);
    try {
        let indexed = 0;
        routesTable.set("/test", async () => {
            indexed += 1
        });
        const { finished } = appHistory.navigate("/test", {
            state: {
                value: 1
            }
        });
        await finished;
        ok(indexed);
    } finally {
        appHistory.removeEventListener("navigate", handler);
    }

}

export async function productBackButtonClicked(appHistory: AppHistory) {
    const backButtonEl = new EventTarget();

    backButtonEl.addEventListener("click", async () => {
        const previous = appHistory.entries()[appHistory.current?.index - 1];
        // console.log({ previous });
        if (previous?.url === "/product-listing") {
            // console.log("Back");
            const { finished } = appHistory.back();
            await finished;
        } else {
            // If the user arrived here by typing the URL directly:
            const { finished } = appHistory.navigate("/product-listing", { replace: true });
            await finished;
        }
    });
    ok(appHistory.entries().length === 0);

    await backButtonEl.dispatchEvent({
        type: "click"
    });

    ok(appHistory.current.url === "/product-listing");
    ok(appHistory.entries().length === 1);

    const { finished } = await appHistory.navigate("/product-listing/product");
    await finished;

    ok(appHistory.current.url === "/product-listing/product");
    ok(appHistory.entries().length === 2);

    await backButtonEl.dispatchEvent({
        type: "click"
    });

    // console.log(appHistory.entries());

    ok(appHistory.current.url === "/product-listing");
    ok(appHistory.entries().length === 2);

}

export async function performanceExample(appHistory: AppHistory) {
    // const performance = await getPerformance();
    //
    // for (const entry of performance?.getEntriesByType("same-document-navigation")) {
    //     console.log(`It took ${entry.duration} ms to navigate to the URL ${entry.name}`);
    // }
}

export async function currentReloadExample(appHistory: AppHistory) {
    await appHistory.navigate('/').finished;
    await appHistory.reload({ state: { ...appHistory.current.getState<{}>(), test: 3 } }).finished;
    ok(appHistory.current.getState<{ test: number }>().test === 3);
}

export async function currentChangeExample(appHistory: AppHistory) {
    let changedEvent: AppHistoryCurrentChangeEvent;
    appHistory.addEventListener("currentchange", event => {
        changedEvent = event;
    });
    ok(!appHistory.current);
    await appHistory.navigate('/').finished;
    assert(changedEvent);
    ok(changedEvent.navigationType);
    ok(!changedEvent.from);
    const initial = appHistory.current;
    assert(initial);
    await appHistory.navigate('/1').finished;
    assert(changedEvent);
    ok(changedEvent.navigationType);
    ok(changedEvent.from);
    ok(changedEvent.from.id === initial.id);
}

export async function homepageGoToExample(appHistory: AppHistory) {
    const homeButton = new EventTarget();

    await appHistory.navigate('/home').finished;
    const homepageKey = appHistory.current.key;
    assert(homepageKey);

    homeButton.addEventListener("click", async () => {
        await appHistory.goTo(homepageKey).finished;
    });

    await appHistory.navigate('/other').finished;
    ok(appHistory.current.url === '/other');

    await homeButton.dispatchEvent({
        type: "click"
    });

    ok(appHistory.current.url === '/home');
}

export async function toggleExample(appHistory: AppHistory) {
    await appHistory.navigate('/').finished;

    interface State {
        detailsOpen?: boolean;
    }

    const detailsElement: EventTarget & { open?: boolean } = new EventTarget();
    detailsElement.addEventListener("toggle", async () => {
        const state = appHistory.current.getState<State>();
        await appHistory.updateCurrent({
            state: {
                ...state,
                detailsOpen: detailsElement.open ?? !state?.detailsOpen
            }
        })?.finished;
    });

    ok(!appHistory.current.getState<State>()?.detailsOpen);

    await detailsElement.dispatchEvent({
        type: "toggle"
    });

    ok(appHistory.current.getState<State>().detailsOpen === true);

    await detailsElement.dispatchEvent({
        type: "toggle"
    });

    ok(appHistory.current.getState<State>().detailsOpen === false);

}

export async function perEntryEventsExample(appHistory: AppHistory) {
    async function showPhoto(photoId: number | string) {
        interface State {
            dateTaken?: string;
            caption?: string;
        }

        const { committed, finished } = await appHistory.navigate(`/photos/${photoId}`, { state: { } });

        // In our app, the `navigate` handler will take care of actually showing the photo and updating the content area.
        const entry = await committed;

        let updateCurrentEntry: AppHistoryEntry;
        let updateCurrentEntryFinished: Promise<AppHistoryEntry>;

        // When we navigate away from this photo, save any changes the user made.
        entry.addEventListener("navigatefrom", async () => {
            const result = appHistory.updateCurrent({
                state: {
                    dateTaken: new Date().toISOString(),
                    caption: `Photo taken on the date ${new Date().toDateString()}`
                }
            });
            // Just ensure committed before we move on
            // We know that this will be applied at a minimum
            updateCurrentEntry = await result?.committed;
            updateCurrentEntryFinished = result?.finished;
        }, { once: true });

        let navigateBackToState: State

        // If we ever navigate back to this photo, e.g. using the browser back button or
        // appHistory.goTo(), restore the input values.
        entry.addEventListener("navigateto", () => {
            navigateBackToState = appHistory.current.getState<State>();
        });

        await finished;

        // Trigger navigatefrom
        await appHistory.navigate("/").finished;

        assert(updateCurrentEntry);
        ok(updateCurrentEntry.getState());
        assert(updateCurrentEntry.key === entry.key);

        ok(updateCurrentEntryFinished);
        await updateCurrentEntryFinished;

        // Trigger naviagateto
        await appHistory.goTo(entry.key).finished;

        assert(appHistory.current.key === entry.key);
        assert(appHistory.current.key === updateCurrentEntry.key);

        const finalState = appHistory.current.getState<State>();

        // console.log({ finalState, navigateBackToState, current: appHistory.current });

        ok(navigateBackToState);
        ok(navigateBackToState.dateTaken);
        ok(navigateBackToState.caption);

        ok(finalState);
        ok(finalState.dateTaken === navigateBackToState.dateTaken);
        ok(finalState.caption === navigateBackToState.caption);

    }
    // console.log("-----");
    await showPhoto('1');
}

export async function disposeExample(appHistory: AppHistory) {

    await appHistory.navigate("/").finished;

    const startingKey = appHistory.current.key;


    const values: (1 | 2 | 3)[] = [];

    const entry1 = await appHistory.navigate("/1").committed;
    const entry2 = await appHistory.navigate("/2").committed;
    const entry3 = await appHistory.navigate("/3").finished;

    entry1.addEventListener("dispose", () => values.push(1));
    entry2.addEventListener("dispose", () => values.push(2));
    entry3.addEventListener("dispose", () => values.push(3));

    await appHistory.goTo(startingKey).finished;
    await appHistory.navigate("/1-b").finished;

    // console.log({ values });

    ok(values.includes(1));
    ok(values.includes(2));
    ok(values.includes(3));

}

export async function currentChangeMonitoringExample(appHistory: AppHistory) {

    appHistory.addEventListener("currentchange", () => {
        appHistory.current.addEventListener("dispose", genericDisposeHandler);
    });

    let disposedCount = 0;

    function genericDisposeHandler() {
        disposedCount += 1;
    }

    await appHistory.navigate("/").finished;

    ok(!disposedCount);
    await appHistory.navigate("/1").finished;
    ok(!disposedCount);
    await appHistory.navigate("/2").finished;
    ok(!disposedCount);

    // Dispose first
    await appHistory.navigate('/', { replace: true }).finished;
    // Dispose Second
    await appHistory.navigate('/', { replace: true }).finished;
    // Should be back at start

    ok(disposedCount === 2);
}

export async function rollbackExample(appHistory: AppHistory) {

    const expectedError = `Error.${Math.random()}`;
    const toasts: string[] = [];

    function showErrorToast(message: string) {
        toasts.push(message);
    }

    let navigateErrorTransitionFinished;

    appHistory.addEventListener("navigateerror", async e => {
        const attemptedURL = appHistory.transition.from.url;

        const { committed, finished } = appHistory.transition.rollback();
        navigateErrorTransitionFinished = finished;
        await committed;

        showErrorToast(`Could not load ${attemptedURL}: ${e.message}`);
    });

    // Should be successful, no failing navigator yet
    await appHistory.navigate("/").finished;

    ok(!toasts.length);

    const expectedRollbackState = await appHistory.navigate(`/${Math.random()}`).finished;

    ok(!toasts.length);

    appHistory.addEventListener("navigate",  (event) => {
        event.transitionWhile(Promise.reject(new Error(expectedError)));
    }, { once: true });

    // This should fail

    const errorUrl = `/thisWillError/${Math.random()}`
    const error = await appHistory.navigate(errorUrl).finished.catch((error) => error);

    // console.log(error);

    assert(error);
    assert(error instanceof Error);
    assert(error.message === expectedError);

    ok(appHistory.current);

    ok(navigateErrorTransitionFinished);
    await navigateErrorTransitionFinished;

    // console.log({ current: appHistory.current, expectedRollbackState, toasts });

    ok(appHistory.current.url === expectedRollbackState.url);

    // console.log({ toasts });

    ok(toasts.length);
    ok(toasts[0].includes(expectedError));
    ok(toasts[0].includes(errorUrl));
}

export async function singlePageAppRedirectsAndGuards(appHistory: AppHistory) {

    function determineAction(destination: AppHistoryDestination): {
        type: string;
        destinationURL: string;
        destinationState: unknown;
        disallowReason?: string;
    } {
        const { pathname, searchParams } = new URL(destination.url, "https://example.com");
        const destinationState: Record<string, unknown> = {
            ...destination.getState<{}>()
        };
        searchParams.forEach(([key, value]) => destinationState[key] = destinationState[key] ?? value);
        const type = ({
            "/redirect": "redirect",
            "/disallow": "disallow"
        } as const)[pathname];
        // console.log({ type, destination });
        return {
            type,
            destinationURL: (type === "redirect" && searchParams.get("target")) || destination.url,
            destinationState,
            disallowReason: type === "disallow" ? (searchParams.get("reason") ?? undefined) : undefined
        }
    }

    let allowCount = 0;
    let disallowCount = 0;

    // TODO replace with transition usage
    let redirectFinished: Promise<AppHistoryEntry>;

    appHistory.addEventListener("navigate", e => {
        e.transitionWhile((async () => {
            const result = await determineAction(e.destination);

            if (result.type === "redirect") {
                redirectFinished = appHistory.transition?.rollback().finished
                    .then(() => appHistory.navigate(result.destinationURL, { state: result.destinationState }).finished);
                await redirectFinished;
                // await appHistory.transition?.rollback().finished;
                // await appHistory.navigate(result.destinationURL, { state: result.destinationState }).finished;
            } else if (result.type === "disallow") {
                disallowCount += 1;
                throw new Error(result.disallowReason);
            } else {
                // ...
                // Allow the transition
                allowCount += 1;
                return;
            }
        })());
    });

    ok(!appHistory.current);

    await appHistory.navigate("/").finished;

    ok(appHistory.current);
    ok(appHistory.current.url === "/");
    ok(allowCount === 1);

    const redirectTargetUrl = `/redirected/${Math.random()}`;

    const targetUrl = new URL("/redirect", "https://example.com");
    targetUrl.searchParams.set("target", redirectTargetUrl);

    const { committed: redirectCommitted, finished: redirectFinishedErrored } = appHistory.navigate(targetUrl.toString());
    redirectFinishedErrored.catch(error => void error);
    await redirectCommitted;

    const redirectError = await redirectFinishedErrored.catch(error => error);
    assert(redirectError);
    assert(redirectError instanceof Error);

    // TODO pending transition here would allow us to see the new navigation changes
    // const pendingTransition = appHistory.transition;
    // ok(pendingTransition);
    // await pendingTransition;
    assert(redirectFinished);
    await redirectFinished;

    ok(appHistory.current.url === redirectTargetUrl);
    ok(allowCount === 2);

    const expectedInitialError = `${Math.random()}`;
    const errorTargetUrl = new URL("/disallow", "https://example.com");
    errorTargetUrl.searchParams.set("reason", expectedInitialError);

    ok(disallowCount === 0);

    const initialError = await appHistory.navigate(errorTargetUrl.toString()).finished.catch(error => error);

    assert(initialError);
    assert(initialError instanceof Error);

    // console.log(initialError);

    assert(initialError.message === expectedInitialError);

    ok(allowCount === 2);
    ok(disallowCount === 1);

}

export async function navigationExamples(appHistory: AppHistory) {
    const url = `/${Math.random()}`;
    const stateSymbol = Symbol();
    const infoSymbol = Symbol();
    const state = { [stateSymbol]: true };
    const info = { [infoSymbol]: true };

    // Performs a navigation to the given URL, but replace the current history entry
    // instead of pushing a new one.
    // (equivalent to `location.replace(url)`)
    await appHistory.navigate(url, { replace: true }).finished;

    // Replace the URL and state at the same time.
    await appHistory.navigate(url, { replace: true, state }).finished;

    // You can still pass along info:
    await appHistory.navigate(url, { replace: true, state, info }).finished;

    // Just like location.reload().
    await appHistory.reload().finished;

    // Leave the state as-is, but pass some info.
    await appHistory.reload({ info }).finished;

    // Overwrite the state with a new value.
    await appHistory.reload({ state, info }).finished;

}

export async function usingInfoExample(appHistory: AppHistory) {

    const photoGallery = new EventTarget();
    const document = new EventTarget();

    const photos = new Map<object, string>(
        Array.from({ length: 10 })
            .map((unused, index) => [{}, `/photo/${index}`])
    );
    const photoTargets = new Map<string, object>(
        [...photos.entries()].map(([key, value]) => [value, key])
    );
    const photoUrls = [...photos.values()];

    function getPhotoSiblings() {
        const index = photoUrls.indexOf(appHistory.current?.url);
        if (index === -1) return [];
        return [photoUrls[index - 1], photoUrls[index + 1]];
    }
    function hasPreviousPhoto() {
        return !!getPreviousPhotoURL();
    }
    function hasNextPhoto() {
        return !!getNextPhotoURL();
    }
    function getPreviousPhotoURL() {
        return getPhotoSiblings()[0];
    }
    function getNextPhotoURL() {
        return getPhotoSiblings()[1];
    }
    function getPhotoURL(target: unknown) {
        if (typeof target !== "object") throw new Error("Expected object target");
        return photos.get(target);
    }
    function isPhotoNavigation<T>(event: T): event is T & { info: { via: string, thumbnail: object } } {
        function isLike(event: unknown): event is { info: Record<string, unknown> } {
            return !!event;
        }
        return (
            isLike(event) &&
            typeof event.info === "object" &&
            typeof event.info.via === "string" &&
            typeof event.info.thumbnail === "object"
        );
    }

    document.addEventListener("keydown", async (event) => {
        if (event.key === "ArrowLeft" && hasPreviousPhoto()) {
            const url = getPreviousPhotoURL();
            await appHistory.navigate(url, { info: { via: "go-left", thumbnail: photoTargets.get(url) } }).finished;
        }
        if (event.key === "ArrowRight" && hasNextPhoto()) {
            const url = getNextPhotoURL();
            await appHistory.navigate(url, { info: { via: "go-right", thumbnail: photoTargets.get(url) } }).finished;
        }
    });

    photoGallery.addEventListener("click", ({ target }: Event & { target?: unknown }) => {
        appHistory.navigate(getPhotoURL(target), { info: { via: "gallery", thumbnail: target } });
    });

    let lefts = 0,
        rights = 0,
        zoomies: object[] = [],
        loaded: string[] = [];

    function animateLeft() {
        lefts += 1;
    }
    function animateRight() {
        rights += 1;
    }
    function animateZoomFromThumbnail(thumbnail: object) {
        zoomies.push(thumbnail)
    }
    async function loadPhoto(url: string) {
        await new Promise<void>(queueMicrotask);
        loaded.push(url);
    }

    appHistory.addEventListener("navigate", e => {
        e.transitionWhile((async () => {
            if (isPhotoNavigation(e)) {
                const { thumbnail, via } = e.info;
                switch (via) {
                    case "go-left": {
                        await animateLeft();
                        break;
                    }
                    case "go-right": {
                        await animateRight();
                        break;
                    }
                    case "gallery": {
                        await animateZoomFromThumbnail(thumbnail);
                        break;
                    }
                }
            }
            await loadPhoto(e.destination.url);
        })());
    });

    const middleIndex = Math.round(photoUrls.length / 2);
    assert(middleIndex === 5);

    // console.log({
    //     via: "navigation",
    //     thumbnail: photoTargets.get(photoUrls[middleIndex])
    // });

    // We have not yet given a starting point
    ok(!hasPreviousPhoto());
    ok(!hasNextPhoto());

    await appHistory.navigate(photoUrls[middleIndex], {
        info: {
            via: "navigation",
            thumbnail: photoTargets.get(photoUrls[middleIndex])
        }
    }).finished;

    // We should now have photos
    ok(hasPreviousPhoto());
    ok(hasNextPhoto());

    ok(!lefts);
    ok(!rights);
    // console.log({ loaded });
    ok(loaded.includes(photoUrls[middleIndex]));

    await document.dispatchEvent({
        type: "keydown",
        key: "ArrowLeft"
    });

    ok(lefts === 1);
    ok(loaded.includes(photoUrls[middleIndex - 1]));

    await document.dispatchEvent({
        type: "keydown",
        key: "ArrowLeft"
    });

    ok(lefts === 2);
    ok(loaded.includes(photoUrls[middleIndex - 2]));

    await document.dispatchEvent({
        type: "keydown",
        key: "ArrowLeft"
    });

    ok(lefts === 3);
    ok(loaded.includes(photoUrls[middleIndex - 3]));

    await document.dispatchEvent({
        type: "keydown",
        key: "ArrowLeft"
    });

    ok(lefts === 4);
    ok(loaded.includes(photoUrls[middleIndex - 4]));

    await document.dispatchEvent({
        type: "keydown",
        key: "ArrowLeft"
    });

    ok(lefts === 5);
    ok(loaded.includes(photoUrls[middleIndex - 5]));

    await document.dispatchEvent({
        type: "keydown",
        key: "ArrowLeft"
    });

    // Should stay the same
    ok(lefts === 5);
    ok(loaded.includes(photoUrls[middleIndex - 5]));

    // Reset to middle, and go the other way
    await appHistory.navigate(photoUrls[middleIndex], {
        info: {
            via: "navigation",
            thumbnail: photoTargets.get(photoUrls[middleIndex])
        }
    }).finished;

    ok(!rights);

    await document.dispatchEvent({
        type: "keydown",
        key: "ArrowRight"
    });

    ok(rights === 1);
    ok(loaded.includes(photoUrls[middleIndex + 1]));

    await document.dispatchEvent({
        type: "keydown",
        key: "ArrowRight"
    });

    ok(rights === 2);
    ok(loaded.includes(photoUrls[middleIndex + 2]));

    await document.dispatchEvent({
        type: "keydown",
        key: "ArrowRight"
    });

    ok(rights === 3);
    ok(loaded.includes(photoUrls[middleIndex + 3]));

    await document.dispatchEvent({
        type: "keydown",
        key: "ArrowRight"
    });

    ok(rights === 4);
    ok(loaded.includes(photoUrls[middleIndex + 4]));

    await document.dispatchEvent({
        type: "keydown",
        key: "ArrowRight"
    });

    // Should stay the same
    ok(rights === 4);
    ok(loaded.includes(photoUrls[middleIndex + 4]));

    ok(!zoomies.length);

    await photoGallery.dispatchEvent({
        type: "click",
        target: photoTargets.get(appHistory.current.url)
    });

    ok(zoomies.length);
    ok(photoTargets.get(appHistory.current.url))
    ok(zoomies.includes(photoTargets.get(appHistory.current.url)));
}