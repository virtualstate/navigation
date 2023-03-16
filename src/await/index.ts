import {NavigateEvent, Navigation, NavigationInterceptOptions} from "../spec/navigation";
import {getNavigation} from "../get-navigation";
import {createNavigationPromise, createRepeatingPromise} from "./create-promise";

export * from "./events";
export * from "./create-promise";

export async function intercept<S>(options?: NavigationInterceptOptions<S>, navigation: Navigation<S> = getNavigation()) {
    return createRepeatingPromise(createInterceptPromise);

    function createInterceptPromise() {
        return createNavigationPromise(
            "navigate",
            navigation,
            onNavigate
        )
    }

    function onNavigate(event: NavigateEvent) {
        event.intercept(options);
    }
}