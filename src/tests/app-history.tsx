import {
    AppHistory,
    AppHistoryCurrentChangeEvent,
    AppHistoryDestination, AppHistoryEntry,
    AppHistoryNavigateEvent
} from "../app-history.prototype";
import {EventTarget} from "@opennetwork/environment";
import {h, toString, VNode} from "@virtualstate/fringe"

export interface AppHistoryAssertFn {
    (given: unknown): asserts given is () => AppHistory
}

export async function assertAppHistory(createAppHistory: () => unknown): Promise<AppHistoryAssertFn> {
    let caught: unknown;

    const tests = [
        initialNavigateThenBack,
        routeHandlerExample,
        productBackButtonClicked,
        performanceExample,
        currentReloadExample,
        currentChangeExample,
        homepageGoToExample,
        toggleExample,
        perEntryEventsExample,
        disposeExample,
        currentChangeMonitoringExample,
        jsxExample,
        rollbackExample,
        singlePageAppRedirectsAndGuards,
        throwError,
    ] as const

    const expectedError = new Error();

    try {
        for (const test of tests) {
            const appHistory = createAppHistory();
            assertAppHistoryLike(appHistory);
            try {
                console.log("START ", test);
                await test(appHistory);
                console.log("PASS  ", test);
            } catch (error) {
                if (error !== expectedError) {
                    caught = caught || error;
                    console.error("ERROR", test, error)
                } else {
                    console.log("PASS  ", test);
                }
            }
        }
    } catch (error) {
        caught = error;
    }

    async function throwError() {
        throw expectedError;
    }

    async function initialNavigateThenBack(appHistory: AppHistory) {
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

    async function routeHandlerExample(appHistory: AppHistory) {

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

    async function productBackButtonClicked(appHistory: AppHistory) {
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

    async function performanceExample(appHistory: AppHistory) {
        // const performance = await getPerformance();
        //
        // for (const entry of performance?.getEntriesByType("same-document-navigation")) {
        //     console.log(`It took ${entry.duration} ms to navigate to the URL ${entry.name}`);
        // }
    }

    async function currentReloadExample(appHistory: AppHistory) {
        await appHistory.navigate('/').finished;
        await appHistory.reload({ state: { ...appHistory.current.getState<{}>(), test: 3 } }).finished;
        ok(appHistory.current.getState<{ test: number }>().test === 3);
    }

    async function currentChangeExample(appHistory: AppHistory) {
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

    async function homepageGoToExample(appHistory: AppHistory) {
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

    async function toggleExample(appHistory: AppHistory) {
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

    async function perEntryEventsExample(appHistory: AppHistory) {
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

    async function disposeExample(appHistory: AppHistory) {

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

    async function currentChangeMonitoringExample(appHistory: AppHistory) {

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

    async function jsxExample(appHistory: AppHistory) {
        interface State {
            dateTaken?: string;
            caption?: string;
        }

        function Component({ caption, dateTaken }: State, input?: VNode) {
            return h(
                "figure",
                {},
                h("date", {}, dateTaken),
                h("figcaption", {}, caption),
                input
            )
            // return (
            //     <figure>
            //         <date>{dateTaken}</date>
            //         <figcaption>{caption}</figcaption>
            //         {input}
            //     </figure>
            // )
        }

        const body: EventTarget & { innerHTML?: string } = new EventTarget();

        appHistory.addEventListener("currentchange", async (event) => {
            await (event.transitionWhile ?? (promise => promise))(handler());
            async function handler() {
                body.innerHTML = await toString(<Component {...appHistory.current.getState<State>() } />)
            }
        });

        ok(!body.innerHTML);

        await appHistory.navigate('/', {
            state: {
                dateTaken: new Date().toISOString(),
                caption: `Photo taken on the date ${new Date().toDateString()}`
            }
        }).finished;

        ok(body.innerHTML);

        const updatedCaption = `Photo ${Math.random()}`;

        ok(!body.innerHTML.includes(updatedCaption));

        await appHistory.updateCurrent({
            state: {
                ...appHistory.current.getState<State>(),
                caption: updatedCaption
            }
        })
            // Not all implementations have support for async resolution
            ?.finished;

        // This test will fail if async resolution is not supported.
        ok(body.innerHTML.includes(updatedCaption));

    }

    async function rollbackExample(appHistory: AppHistory) {

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

    async function singlePageAppRedirectsAndGuards(appHistory: AppHistory) {

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

    function assertAppHistoryLike(appHistory: unknown): asserts appHistory is AppHistory {
        function isLike(appHistory: unknown): appHistory is Partial<AppHistory> {
            return !!appHistory;
        }
        const is = (
            isLike(appHistory) &&
            typeof appHistory.navigate === "function" &&
            typeof appHistory.back === "function" &&
            typeof appHistory.forward === "function"
        );
        if (!is) throw new Error("Expected AppHistory instance");
    }


    return (given) => {
        if (given !== createAppHistory) throw new Error("Expected same instance to be provided to assertion");
        if (caught) throw caught;
    }

    function ok(value: unknown) {
        assert(value);
    }

    function assert(value: unknown, message?: string): asserts value {
        if (!value) throw new Error(message);
    }


}

async function getPerformance(): Promise<Pick<typeof performance, "now"> | undefined> {
    if (typeof performance !== "undefined") {
        return performance;
    }
    const { performance: nodePerformance } = await import("perf_hooks");
    return nodePerformance;
}
