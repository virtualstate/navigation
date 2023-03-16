import { NavigateEvent, Navigation, NavigationInterceptOptions } from "../spec/navigation";
import { getNavigation } from "../get-navigation";
import { createNavigationPromise } from "./create-promise";

export * from "./events";
export * from "./create-promise";

export function intercept<S>(options?: NavigationInterceptOptions<S>, navigation: Navigation<S> = getNavigation()) {
    return createNavigationPromise(
        "navigate",
        navigation,
        onNavigate
    );

    function onNavigate(event: NavigateEvent) {
        event.intercept(options);
    }
}