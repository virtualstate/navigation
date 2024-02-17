import {NavigateEvent, Navigation, NavigationEventMap} from "./navigation";
import {EventCallback, Event, EventTargetAddListenerOptions} from "./event-target";
import {NavigationNavigation} from "./navigation-navigation";
import {ok} from "./is";

export interface InstallRoutingNavigationEvent extends Event<"install"> {
    waitUntil(promise: Promise<void>): void;
    addRoutes(routes: unknown[]): void;
}

export interface RoutedNavigateEvent extends NavigateEvent {
    routerCallbackId?: string;
}

export interface RoutingNavigation {
    addEventListener(type: "install", fn: EventCallback<InstallRoutingNavigationEvent>): void
    addEventListener(type: "navigate", fn: EventCallback<RoutedNavigateEvent>): void
}

export class RoutingNavigation extends NavigationNavigation implements RoutingNavigation {

    #navigateEventCallbacks = new WeakMap<EventCallback<NavigateEvent>, EventCallback<NavigateEvent>>()

    async install() {
        await this.dispatchEvent({
            type: "install",
            addRoutes: this.addRoutes
        });
    }

    addEventListener<K extends keyof NavigationEventMap<unknown>>(type: K, listener: EventCallback<NavigationEventMap<unknown>[K]>, options?: boolean | EventTargetAddListenerOptions) {
        if (type === "navigate") {
            this.#addNavigateEventListener(listener);
        } else {
            super.addEventListener(type, listener, options);
        }
    }

    #addNavigateEventListener(listener: EventCallback<NavigateEvent>, options?: boolean | EventTargetAddListenerOptions) {
        if (this.#navigateEventCallbacks.get(listener) && this.hasEventListener("navigate", this.#navigateEventCallbacks.get(listener))) {
            return;
        }
        this.#navigateEventCallbacks.set(listener, routableListener);
        this.addEventListener("navigate", routableListener);

        function routableListener(event: NavigateEvent) {

        }
    }

    #removeNavigateEventListener(listener: EventCallback<NavigateEvent>) {
        const fn = this.#navigateEventCallbacks.get(listener);
        if (!fn) return;
        this.removeEventListener("navigate", fn);
        this.#navigateEventCallbacks.delete(listener);
    }

    removeEventListener<K extends keyof NavigationEventMap<unknown>>(type: K, listener: EventCallback<NavigationEventMap<unknown>[K]>, options?: boolean | EventListenerOptions) {
        if (type === "navigate") {
            this.#removeNavigateEventListener(listener)
        } else {
            super.removeEventListener(type, listener, options);
        }
    }

    hasEventListener(type: string | symbol, callback?: Function): boolean {
        if (type === "navigate" && callback) {
            ok<EventCallback<NavigateEvent>>(callback)
            const fn = this.#navigateEventCallbacks.get(callback);
            if (fn) {
                return super.hasEventListener("navigate", fn);
            } else {
                return false;
            }
        } else {
            return super.hasEventListener(type, callback);
        }
    }

    addRoutes = (routes: unknown[]) => {

    }


}

const globalNavigation =  new Navigation();

{
    const navigation = new RoutingNavigation(globalNavigation);

    navigation.addEventListener("install", event => event.addRoutes([
        {
            condition: { urlPattern: { pathname: "/users" } }
        }
    ]))

    navigation.addEventListener("navigate", event => {
        // Auto intercepted user routes
    })
}

{
    const navigation = new RoutingNavigation(globalNavigation);

    navigation.addEventListener("install", event => event.addRoutes([
        {
            condition: { urlPattern: { pathname: "/products" } }
        }
    ]))

    navigation.addEventListener("navigate", event => {
        // Auto intercepted product routes
    })
}

{
    const navigation = new RoutingNavigation(globalNavigation);

    navigation.addEventListener("install", event => event.addRoutes([
        {
            condition: { urlPattern: { pathname: "/documents" } },
            source: [
                {
                    type: "cache"
                },
                {
                    type: "fetch-event"
                },
                {
                    type: "navigate-event"
                }
            ]
        }
    ]))

    navigation.addEventListener("navigate", event => {
        // No event, document replaced by fetch event
        // Unless fetch-event and cache returned not ok
    })
}


{
    const navigation = new RoutingNavigation(globalNavigation);

    navigation.addEventListener("install", event => event.addRoutes([
        {
            condition: { urlPattern: { pathname: "/users" } }
        }
    ]))

    navigation.addEventListener("navigate", event => {
        // Auto intercepted user routes
    })
}

{
const navigation = new RoutingNavigation(globalNavigation);

navigation.addRoutes([
    {
        condition: { urlPattern: { pathname: "/users" } },
        source: [
            // We could say we want to use the navigate event here, or
            // if we define other sources, we can try them first
            // "navigate-event"
            (event: NavigateEvent) => {
                // We are in the /users page
            }
        ]
    },
    {
        condition: { urlPattern: { pathname: "/products" } },
        source: (event: NavigateEvent) => event.intercept(async () => {
            // We are in the /products page
            // Make changes to the DOM here dynamically

            // The event could be potentially
            event.formData
        })
    },
    {
        condition: [
            { requestMethod: "get" },
            { urlPattern: { pathname: "/documents" } }
        ],
        source: [
            {
                type: "cache"
            },
            {
                type: "fetch-event"
            },
            (event: NavigateEvent) => {
                // We're not in service worker land
                // we can do what we want
                return new Response("We could even allow response sources right here from a navigate");
            }
        ]
    },
    {
        condition: [
            { urlPattern: { pathname: "/documents" } }
        ],
        source: [
            {
                type: "fetch-event"
            },
            ({ formData }: NavigateEvent) => {
                // We have some offline form data
            }
        ]
    }
])
}

{

}

