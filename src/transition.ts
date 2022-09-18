import {Navigation, NavigationTransition} from "./spec/navigation";

export async function transition<S>(navigation: Navigation<S>) {
    let transition: NavigationTransition<S> | undefined = undefined;
    let finalPromise;
    while (navigation.transition && transition !== navigation.transition) {
        transition = navigation.transition;
        finalPromise = transition.finished;
        await finalPromise.catch(error => void error);
    }
    return finalPromise;
}