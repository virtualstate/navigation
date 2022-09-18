import {Navigation, NavigationTransition} from "./spec/navigation";

export async function transition(navigation: Navigation) {
    let transition: NavigationTransition | undefined = undefined;
    let finalPromise;
    while (navigation.transition && transition !== navigation.transition) {
        transition = navigation.transition;
        finalPromise = transition.finished;
        await finalPromise.catch(error => void error);
    }
    return finalPromise;
}