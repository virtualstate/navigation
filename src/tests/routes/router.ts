import {NavigationNavigation} from "../../navigation-navigation";
import {Navigation, NavigateEvent} from "../../spec/navigation";
import {URLPattern} from "urlpattern-polyfill";
import {getNavigation} from "../../get-navigation";

type NonNil<T> = T extends (null | undefined) ? never : T;
export type URLPatternResult = NonNil<ReturnType<URLPattern["exec"]>>

interface RouteFn {
    (event: NavigateEvent, match: URLPatternResult): Promise<void | unknown> | unknown | void
}

interface Route {
    pattern: URLPattern;
    fn: RouteFn
}

const Routes = Symbol.for("@virtualstate/navigation/routes/routes");

export class Router extends NavigationNavigation {

    [Routes] = new Set<Route>();
    private listening = false;

    constructor(navigation: Navigation = getNavigation()) {
        super(navigation);
    }

    routes(router: Router): Router {
        for (const route of router[Routes]) {
            this[Routes].add(route);
        }
        this.#init();
        return this;
    }

    route(pattern: string | URLPattern, fn: RouteFn): Router {
        if (typeof pattern === "string") {
            const { origin } = new URL(this.currentEntry.url);
            pattern = new URLPattern({ pathname: pattern, baseURL: origin });
        }
        this[Routes].add({
            pattern,
            fn
        });
        this.#init();
        return this;
    }

    #init = () => {
        if (this.listening) {
            return;
        }
        this.listening = true;
        this.addEventListener("navigate", this.#navigate);
    }

    #navigate = (event: NavigateEvent) => {
        if (!this[Routes].size) return;
        event.transitionWhile(
            this.#navigationTransition(event)
        );
    }

    #navigationTransition = async (event: NavigateEvent) => {
        const {
            destination: {
                url
            }
        } = event;
        const promises: Promise<unknown>[] = [];
        for (const route of this[Routes]) {
            const { pattern, fn } = route;
            const match = pattern.exec(url);
            if (!match) continue;
            try {
                const maybePromise = fn(event, match);
                if (isPromise(maybePromise)) {
                    promises.push(maybePromise);
                }
            } catch (error) {
                promises.push(Promise.reject(error));
            }
        }
        if (promises.length) {
            await Promise.all(promises);
        }

        function isPromise(value: unknown): value is Promise<unknown> {
            function isPromiseLike(value: unknown): value is Promise<unknown> {
                return !!(
                    value &&
                    typeof value === "object" &&
                    "then" in value
                )
            }
            return (
                isPromiseLike(value) &&
                typeof value.then === "function"
            );
        }

    }

}