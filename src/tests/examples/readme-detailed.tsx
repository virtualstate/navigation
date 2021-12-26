import { ok, assert } from "../util";
import {
    AppHistory,
    AppHistoryCurrentChangeEvent, AppHistoryDestination,
    AppHistoryEntry,
    AppHistoryNavigateEvent
} from "../../spec/app-history";
import {AsyncEventTarget as EventTarget, Event} from "../../event-target"
import {FetchEvent, fetch} from "./fetch"
import {addEventListener, removeEventListener} from "../../event-target/global";
import {h} from "@virtualstate/fringe";
import {Response} from "@opennetwork/http-representation";

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

    let caught;
    if (!appHistory.canGoBack) {
        try {
            await appHistory.back();
        } catch (error) {
            // No initial back
            caught = error;
        }
    }
    assert(caught);
}

export async function routeHandlerExample(appHistory: AppHistory) {

    const routesTable = new Map<string, () => Promise<void>>();

    function handler(event: AppHistoryNavigateEvent) {
        if (!event.canTransition || event.hashChange) {
            return;
        }
        if (routesTable.has(event.destination.url)) {
            const routeHandler = routesTable.get(event.destination.url);
            if (!routeHandler) return;
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
        const previous = appHistory.entries()[appHistory.current?.index ?? -2 - 1];
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

    ok(appHistory.current?.url === "/product-listing");
    ok(appHistory.entries().length === 1);

    const { finished } = await appHistory.navigate("/product-listing/product");
    await finished;

    ok(appHistory.current?.url === "/product-listing/product");
    ok(appHistory.entries().length === 2);

    await backButtonEl.dispatchEvent({
        type: "click"
    });

    // console.log(appHistory.entries());

    ok(appHistory.current?.url === "/product-listing");
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
    await appHistory.reload({ state: { ...appHistory.current?.getState<{}>(), test: 3 } }).finished;
    ok(appHistory.current?.getState<{ test: number }>().test === 3);
}

export async function currentChangeExample(appHistory: AppHistory) {
    let changedEvent!: AppHistoryCurrentChangeEvent;
    appHistory.addEventListener("currentchange", event => {
        changedEvent = event;
    });
    ok(!appHistory.current);
    await appHistory.navigate('/').finished;
    assert<AppHistoryCurrentChangeEvent>(changedEvent);
    ok(changedEvent.navigationType);
    ok(!changedEvent.from);
    const initial = appHistory.current;
    assert<AppHistoryEntry>(initial);
    await appHistory.navigate('/1').finished;
    assert<AppHistoryCurrentChangeEvent>(changedEvent);
    ok(changedEvent.navigationType);
    assert<AppHistoryEntry>(changedEvent.from);
    ok(changedEvent.from.id === initial.id);
}

export async function homepageGoToExample(appHistory: AppHistory) {
    const homeButton = new EventTarget();

    await appHistory.navigate('/home').finished;
    const homepageKey = appHistory.current?.key;
    assert<string>(homepageKey);

    homeButton.addEventListener("click", async () => {
        await appHistory.goTo(homepageKey).finished;
    });

    await appHistory.navigate('/other').finished;
    ok(appHistory.current?.url === '/other');

    await homeButton.dispatchEvent({
        type: "click"
    });

    ok(appHistory.current?.url === '/home');
}

export async function toggleExample(appHistory: AppHistory) {
    await appHistory.navigate('/').finished;

    interface State {
        detailsOpen?: boolean;
    }

    const detailsElement: EventTarget & { open?: boolean } = new EventTarget();
    detailsElement.addEventListener("toggle", async () => {
        const state = appHistory.current?.getState<State>();
        await appHistory.updateCurrent({
            state: {
                ...state,
                detailsOpen: detailsElement.open ?? !state?.detailsOpen
            }
        })?.finished;
    });

    ok(!appHistory.current?.getState<State>()?.detailsOpen);

    await detailsElement.dispatchEvent({
        type: "toggle"
    });

    ok(appHistory.current?.getState<State>().detailsOpen === true);

    await detailsElement.dispatchEvent({
        type: "toggle"
    });

    ok(appHistory.current?.getState<State>().detailsOpen === false);

}

export async function perEntryEventsExample(appHistory: AppHistory) {
    async function showPhoto(photoId: number | string) {
        interface State {
            dateTaken?: string;
            caption?: string;
        }

        const { committed, finished } = appHistory.navigate(`/photos/${photoId}`, { state: { } });

        // In our app, the `navigate` handler will take care of actually showing the photo and updating the content area.
        const entry = await committed;

        let updateCurrentEntryCommitted!: Promise<AppHistoryEntry>;
        let updateCurrentEntryFinished!: Promise<AppHistoryEntry>;

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
            updateCurrentEntryCommitted = result?.committed;
            updateCurrentEntryFinished = result?.finished;
        }, { once: true });

        let navigateBackToState!: State;

        // If we ever navigate back to this photo, e.g. using the browser back button or
        // appHistory.goTo(), restore the input values.
        entry.addEventListener("navigateto", () => {
            const next = appHistory.current?.getState<State>();
            if (next) {
                navigateBackToState = next;
            }
        });

        await finished;

        // Trigger navigatefrom
        await appHistory.navigate("/").finished;

        assert(updateCurrentEntryCommitted);
        const updateCurrentEntry = await updateCurrentEntryCommitted;

        assert(updateCurrentEntry);
        ok(updateCurrentEntry.getState());
        assert(updateCurrentEntry.key === entry.key);

        ok(updateCurrentEntryFinished);
        await updateCurrentEntryFinished;

        // Trigger naviagateto
        await appHistory.goTo(entry.key).finished;

        assert(appHistory.current?.key === entry.key);
        assert<AppHistoryEntry>(updateCurrentEntry);
        assert(appHistory.current?.key === updateCurrentEntry.key);

        const finalState = appHistory.current?.getState<State>();

        // console.log({ finalState, navigateBackToState, current: appHistory.current });

        assert<State>(navigateBackToState);
        ok(navigateBackToState.dateTaken);
        ok(navigateBackToState.caption);

        assert<State>(finalState);
        assert<State>(navigateBackToState);
        ok(finalState.dateTaken === navigateBackToState.dateTaken);
        ok(finalState.caption === navigateBackToState.caption);

    }
    // console.log("-----");
    await showPhoto('1');
}

export async function disposeExample(appHistory: AppHistory) {

    await appHistory.navigate("/").finished;

    const startingKey = appHistory.current?.key;

    assert<string>(startingKey);

    const values: (1 | 2 | 3)[] = [];
    assert(values);
    console.log(JSON.stringify({ 0: values }));

    const { committed: entry1Committed, finished: entry1Finished } = appHistory.navigate("/1");
    const entry1 = await entry1Committed;
    entry1.addEventListener("dispose", () => values.push(1));
    const entry1Disposed = new Promise(resolve => entry1.addEventListener("dispose", resolve, { once: true }));
    await entry1Finished;

    const { committed: entry2Committed, finished: entry2Finished } = appHistory.navigate("/2");
    const entry2 = await entry2Committed;
    const entry2Disposed = new Promise(resolve => entry2.addEventListener("dispose", resolve, { once: true }));
    entry2.addEventListener("dispose", () => values.push(2));

    await entry2Finished;

    const { committed: entry3Committed, finished: entry3Finished } = await appHistory.navigate("/3");
    const entry3 = await entry3Committed;
    const entry3Disposed = new Promise(resolve => entry3.addEventListener("dispose", resolve, { once: true }));
    entry3.addEventListener("dispose", () => values.push(3));
    await entry3Finished;

    await appHistory.goTo(startingKey).finished;
    await appHistory.navigate("/1-b").finished;

    await Promise.all([entry1Disposed, entry2Disposed, entry3Disposed]);

    // console.log(JSON.stringify({ 3: values, entries: appHistory.entries() }));

    ok(values.includes(1));
    ok(values.includes(2));
    ok(values.includes(3));
    console.log(JSON.stringify(values));

}

export async function currentChangeMonitoringExample(appHistory: AppHistory) {

    appHistory.addEventListener("currentchange", () => {
        appHistory.current?.addEventListener("dispose", genericDisposeHandler);
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


    // rollback is automatically triggered on error
    // let navigateErrorTransitionFinished,
    //     navigateErrorTransitionCommitted;

    appHistory.addEventListener("navigateerror", async e => {
        const transition = appHistory.transition;
        // console.log("Navigate error inner", { transition });
        if (!transition) return;

        const attemptedURL = transition.from.url;

        // rollback is automatically triggered on error
        // const { committed, finished } = transition.rollback();
        // navigateErrorTransitionCommitted = committed;
        // navigateErrorTransitionFinished = finished;
        // navigateErrorTransitionCommitted.then(() => );

        showErrorToast(`Could not load ${attemptedURL}: ${e.message}`);
    });

    // Should be successful, no failing navigator yet
    await appHistory.navigate("/").finished;

    ok(!toasts.length);

    const expectedRollbackState = await appHistory.navigate(`/${Math.random()}`).finished;

    ok(!toasts.length);

    // Reject after committed using currentchange, or before committed using navigate
    appHistory.addEventListener("navigate",  (event) => {
        event.transitionWhile(Promise.reject(new Error(expectedError)));
    }, { once: true });

    // This should fail

    const errorUrl = `/thisWillError/${Math.random()}`

    const { committed, finished } = await appHistory.navigate(errorUrl);

    const [committedError, finishedError] = await Promise.all([
        committed.catch((error) => error),
        finished.catch((error) => error)
    ]);

    // console.log({
    //     committedError,
    //     finishedError
    // });

    assert<Error>(committedError);
    assert(committedError instanceof Error);
    assert(committedError.message === expectedError);
    assert<Error>(finishedError);
    assert(finishedError instanceof Error);
    assert(finishedError.message === expectedError);

    ok(appHistory.current);


    // rollback is automatically triggered on error
    // ok(navigateErrorTransitionCommitted);
    // await navigateErrorTransitionCommitted;
    //
    // ok(navigateErrorTransitionFinished);
    // await navigateErrorTransitionFinished;

    // console.log({ current: appHistory.current, expectedRollbackState, toasts });

    ok(appHistory.current?.url === expectedRollbackState.url);

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
        } as const)[pathname] ?? "pass";

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
    let redirectFinished: Promise<AppHistoryEntry> | undefined = undefined;

    appHistory.addEventListener("navigate", e => {
        e.transitionWhile((async () => {
            const result = determineAction(e.destination);

            if (result.type === "redirect") {
                redirectFinished = appHistory.transition?.rollback().finished
                    .then(() => appHistory.navigate(result.destinationURL, { state: result.destinationState }).finished);
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
    ok(appHistory.current?.url === "/");
    ok(allowCount === 1);

    const redirectTargetUrl = `/redirected/${Math.random()}`;

    const targetUrl = new URL("/redirect", "https://example.com");
    targetUrl.searchParams.set("target", redirectTargetUrl);

    const { committed: redirectCommitted, finished: redirectFinishedErrored } = appHistory.navigate(targetUrl.toString());
    redirectFinishedErrored.catch(error => void error);
    await redirectCommitted.catch(error => void error);

    const redirectError = await redirectFinishedErrored.catch(error => error);

    // console.log({ redirectError });

    assert(redirectError);
    assert(redirectError instanceof Error);

    // TODO pending transition here would allow us to see the new navigation changes
    // const pendingTransition = appHistory.transition;
    // ok(pendingTransition);
    // await pendingTransition;
    assert(redirectFinished);
    await redirectFinished;

    ok(appHistory.current?.url === redirectTargetUrl);
    ok(allowCount === 2);

    const expectedInitialError = `${Math.random()}`;
    const errorTargetUrl = new URL("/disallow", "https://example.com");
    errorTargetUrl.searchParams.set("reason", expectedInitialError);

    ok(disallowCount === 0);

    const { committed: disallowCommitted, finished: disallowFinished } = appHistory.navigate(errorTargetUrl.toString());
    await disallowCommitted.catch(error => error);
    const initialError = await disallowFinished.catch(error => error);

    assert<Error>(initialError);
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
        const index = photoUrls.indexOf(appHistory.current?.url ?? "/unknown");
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
        if (!target || typeof target !== "object") throw new Error("Expected object target");
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

    photoGallery.addEventListener("click", async ({ target }: Event & { target?: unknown }) => {
        const url = getPhotoURL(target);
        if (!url) return;
        await appHistory.navigate(url, { info: { via: "gallery", thumbnail: target } }).finished;
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
        target: photoTargets.get(appHistory.current?.url ?? "/unknown")
    });

    ok(zoomies.length);
    ok(photoTargets.get(appHistory.current?.url ?? "/unknown"))
    ok(zoomies.includes(photoTargets.get(appHistory.current?.url ?? "/unknown") ?? {}));
}

export async function nextPreviousButtons(appHistory: AppHistory) {
    const appState = {
        currentPhoto: 0,
        totalPhotos: 10
    };
    const photos: Record<string, string> = {};
    const next: EventTarget & { disabled?: boolean } = new EventTarget();
    const previous: EventTarget & { disabled?: boolean } = new EventTarget();
    const permalink: EventTarget & { disabled?: boolean, textContent?: string } = new EventTarget();
    const currentPhoto: EventTarget & { src?: string } = new EventTarget();

    next.addEventListener("click", async () => {
        const nextPhotoInHistory = photoNumberFromURL(appHistory.entries()[(appHistory.current?.index ?? -2) + 1]?.url);
        if (nextPhotoInHistory === appState.currentPhoto + 1) {
            await appHistory.forward().finished;
        } else {
            await appHistory.navigate(`/photos/${appState.currentPhoto + 1}`).finished;
        }
    });

    previous.addEventListener("click", async () => {
        const prevPhotoInHistory = photoNumberFromURL(appHistory.entries()[(appHistory.current?.index ?? -2) - 1]?.url);
        // console.log(prevPhotoInHistory)
        // console.log({ prevPhotoInHistory, matching: appState.currentPhoto - 1, nav: `/photos/${appState.currentPhoto - 1}` });
        if (prevPhotoInHistory === appState.currentPhoto - 1) {
            // console.log("BACK!");
            await appHistory.back().finished;
        } else {
            // console.log({ navigate: `/photos/${appState.currentPhoto - 1}` })
            await appHistory.navigate(`/photos/${appState.currentPhoto - 1}`).finished;
        }
    })

    const photosPrefix = "/raw-photos"
    const contentPhotosPrefix = `/photo/content${photosPrefix}`

    const localCache = new Map<string, string>();

    let fetchCount = 0;

    const fetchHandler = (event: FetchEvent) => {
        const { pathname } = new URL(event.request.url, "https://example.com");
        const [, photoNumber] = pathname.match(/^\/raw-photos\/(\d+)\.[a-z]+$/i) ?? [];
        if (!photoNumber) return;
        fetchCount += 1;
        photos[photoNumber] = photos[photoNumber] || `https://example.com${contentPhotosPrefix}/${photoNumber}`;
        return event.respondWith(
            new Response(photos[photoNumber], {
                status: 200
            })
        );
    };

    addEventListener("fetch", fetchHandler);

    appHistory.addEventListener("navigate", event => {
        const photoNumberMaybe = photoNumberFromURL(event.destination.url);
        if (!(typeof photoNumberMaybe === "number" && event.canTransition)) return;
        const photoNumber: number = photoNumberMaybe;
        event.transitionWhile(handler());
        async function handler() {


            // Synchronously update app state and next/previous/permalink UI:
            appState.currentPhoto = photoNumber;
            previous.disabled = appState.currentPhoto === 0;
            next.disabled = appState.currentPhoto === appState.totalPhotos - 1;
            permalink.textContent = event.destination.url;

            const existingSrc = localCache.get(event.destination.key);
            if (typeof existingSrc === "string") {
                currentPhoto.src = existingSrc;
                return;
            }

            // Asynchronously update the photo, passing along the signal so that
            // it all gets aborted if another navigation interrupts us:
            const response = await fetch(`${photosPrefix}/${photoNumber}.jpg`, { signal: event.signal });
            // const blob = await response.blob();
            // currentPhoto.src = URL.createObjectURL(blob);
            const src = await response.text();
            currentPhoto.src = src;
            localCache.set(event.destination.key, src);
        }
    });

    // Is not a photo should not load
    await appHistory.navigate("/").finished;

    ok(!currentPhoto.src);

    await appHistory.navigate("/photos/0").finished;

    assert<string>(currentPhoto.src);
    ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/0`);
    ok(!next.disabled);
    ok(previous.disabled);

    await appHistory.navigate("/photos/1").finished;

    assert<string>(currentPhoto.src);
    ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/1`);
    ok(!next.disabled);
    ok(!previous.disabled);

    // log: Updated window pathname to /photos/2
    await next.dispatchEvent({
        type: "click"
    });
    // Utilised navigate
    assert<string>(currentPhoto.src);
    ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/2`);

    await appHistory.navigate("/photos/9").finished;

    assert<string>(currentPhoto.src);
    ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/9`);

    ok(next.disabled);
    ok(!previous.disabled);

    // log: Updated window pathname to /photos/8
    await previous.dispatchEvent({
        type: "click"
    });

    assert<string>(currentPhoto.src);
    // console.log(currentPhoto);
    // Utilised navigate
    ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/8`);

    // log: Updated window pathname to /photos/7
    await previous.dispatchEvent({
        type: "click"
    });

    assert<string>(currentPhoto.src);
    // Utilised navigate
    ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/7`);

    // Updated window pathname to /photos/8
    await next.dispatchEvent({
        type: "click"
    });
    // Updated window pathname to /photos/9
    await next.dispatchEvent({
        type: "click"
    });

    // Utilised navigation!
    assert<string>(currentPhoto.src);
    ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/9`);

    // This should be 8
    const finalFetchCount = fetchCount;
    assert(finalFetchCount === 8);

    // log: Updated window pathname to /photos/8
    await previous.dispatchEvent({
        type: "click"
    });

    // Utilised back!
    assert<string>(currentPhoto.src);
    ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/8`);

    // log: Updated window pathname to /photos/7
    await previous.dispatchEvent({
        type: "click"
    });

    // Utilised back!
    assert<string>(currentPhoto.src);
    ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/7`);

    // console.log({ finalFetchCount, fetchCount });

    ok(finalFetchCount === fetchCount);

    // log: Updated window pathname to /photos/8
    await next.dispatchEvent({
        type: "click"
    });

    // Utilised forward!
    assert<string>(currentPhoto.src);
    ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/8`);
    ok(finalFetchCount === fetchCount);

    // log: Updated window pathname to /photos/9
    await next.dispatchEvent({
        type: "click"
    });

    // Utilised forward!
    assert<string>(currentPhoto.src);
    ok(new URL(currentPhoto.src).pathname === `${contentPhotosPrefix}/9`);
    ok(finalFetchCount === fetchCount);

    removeEventListener("fetch", fetchHandler);

    function photoNumberFromURL(url?: string) {
        if (!url) {
            return undefined;
        }
        const [,photoNumber] = /\/photos\/(\d+)/.exec((new URL(url, "https://example.com")).pathname) ?? [];
        if (photoNumber) {
            return +photoNumber;
        }
        return undefined;
    }

}