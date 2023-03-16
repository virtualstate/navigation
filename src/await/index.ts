import { NavigateEvent, Navigation, NavigationInterceptOptions } from "../spec/navigation";
import { getNavigation } from "../get-navigation";
import { createNavigationPromise } from "./create-promise";
import {isPromise, ok} from "../is";

export * from "./events";
export * from "./create-promise";

export function intercept<S>(options?: NavigationInterceptOptions<S>, navigation: Navigation<S> = getNavigation()) {
    return createNavigationPromise(
        "navigate",
        navigation,
        options?.handler ? onNavigateWithHandler : onNavigateDirectIntercept
    );

    function onNavigateDirectIntercept(event: NavigateEvent) {
        event.intercept(options);
    }

    function onNavigateWithHandler(event: NavigateEvent) {
        ok(options?.handler, "Expected options.handler");
        const { handler, ...rest } = options;
        return new Promise<void>(
            (resolve, reject) => {
                event.intercept({
                    ...rest,
                    async handler() {
                        try {
                            const result = handler();
                            if (isPromise(result)) {
                                await result;
                            }
                            resolve();
                        } catch (error) {
                            reject(error)
                        }
                    }
                });
            }
        )
    }
}