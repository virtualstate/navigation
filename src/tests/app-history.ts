import {AppHistory, AppHistoryCurrentChangeEvent, AppHistoryNavigateEvent} from "../app-history.prototype";
import {EventTarget} from "@opennetwork/environment";
import type { Performance } from "perf_hooks";

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
    ] as const

    try {
        for (const test of tests) {
            const appHistory = createAppHistory();
            assertAppHistoryLike(appHistory);
            await test(appHistory);
        }
    } catch (error) {
        caught = error;
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
        detailsElement.addEventListener("toggle", () => {
            const state = appHistory.current.getState<State>();
            appHistory.updateCurrent({
                state: {
                    ...state,
                    detailsOpen: detailsElement.open ?? !state?.detailsOpen
                }
            })
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

            // When we navigate away from this photo, save any changes the user made.
            entry.addEventListener("navigatefrom", () => {
                appHistory.updateCurrent({
                    state: {
                        dateTaken: new Date().toISOString(),
                        caption: `Photo taken on the date ${new Date().toDateString()}`
                    }
                });
            });

            let navigateBackToState: State

            // If we ever navigate back to this photo, e.g. using the browser back button or
            // appHistory.goTo(), restore the input values.
            entry.addEventListener("navigateto", () => {
                navigateBackToState = appHistory.current.getState<State>();
            });

            await finished;

            // Trigger navigatefrom
            await appHistory.navigate("/").finished;

            // Trigger naviagateto
            await appHistory.goTo(entry.key).finished;

            const finalState = appHistory.current.getState<State>();

            // console.log({ finalState, navigateBackToState });

            ok(navigateBackToState);
            ok(navigateBackToState.dateTaken);
            ok(navigateBackToState.caption);

            ok(finalState);
            ok(finalState.dateTaken === navigateBackToState.dateTaken);
            ok(finalState.caption === navigateBackToState.caption);

        }
        await showPhoto('1');
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
