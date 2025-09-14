import {Navigation} from "../navigation";
import {ok} from "./util";
import {NavigateEvent} from "../spec/navigation";

{

    const navigation = new Navigation();

    let eventReceived = false,
        eventAsserted = false,
        error = undefined

    function noopIntercept(event: NavigateEvent) {
        event.intercept({
            async handler() {}
        })
    }

    navigation.addEventListener("navigate", noopIntercept)

    await navigation.navigate("/").finished;

    navigation.removeEventListener("navigate", noopIntercept)

    function navigatePush(event: NavigateEvent) {
        const { transition: { from: { key: fromKey } }, currentEntry } = navigation;
        const { destination: { key: destinationKey }, navigationType } = event;
        eventReceived = true;

        try {
            ok(navigationType === "push", "Expected navigationType to be push");
            ok(fromKey, "Expected navigation.transition.from.key");
            ok(destinationKey, "Expected destination.key");
            ok(fromKey !== destinationKey, "Expected event.destination.key to not match navigation.transition.from.key");
            eventAsserted = true;
        } catch (caught) {
            error = caught;
        }

        noopIntercept(event);
    }

    navigation.addEventListener("navigate", navigatePush)

    await navigation.navigate("/1").finished;

    navigation.removeEventListener("navigate", navigatePush)

    ok(eventReceived, "Event not received")
    ok(eventAsserted, error ?? "Event not asserted");

    eventReceived = undefined;
    eventAsserted = undefined;
    error = undefined;

    function navigateReplace(event: NavigateEvent) {
        eventReceived = true;
        const { transition: { from: { key: fromKey } } } = navigation;
        const { destination: { key: destinationKey }, navigationType } = event;
        try {
            ok(navigationType === "replace", "Expected navigationType to be replace");
            ok(fromKey, "Expected navigation.transition.from.key");
            ok(destinationKey, "Expected destination.key");
            ok(fromKey === destinationKey, "Expected event.destination.key to match navigation.transition.from.key");
            eventAsserted = true;
        } catch (caught) {
            error = caught;
        }
        noopIntercept(event);
    }

    navigation.addEventListener("navigate", navigateReplace);

    await navigation.navigate(navigation.currentEntry.url, { history: "auto" }).finished;

    navigation.removeEventListener("navigate", navigateReplace)

    ok(eventReceived, "Event not received")
    ok(eventAsserted, error ?? "Event not asserted")

}