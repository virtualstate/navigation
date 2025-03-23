import {Navigation} from "../navigation";
import {ok} from "./util";

{

    const navigation = new Navigation();

    let eventReceived = false,
        eventAsserted = false,
        error = undefined

    navigation.addEventListener("navigate", (event) => {

        eventReceived = true;
        const { transition: { from: { key: fromKey } }, currentEntry: { key: currentKey } } = navigation;

        try {
            ok(fromKey, "Expected navigation.transition.from.key");
            ok(currentKey, "Expected navigation.currentEntry.key");
            ok(currentKey === fromKey, "Expected event.destination.key to match navigation.currentEntry.key");
            eventAsserted = true;
        } catch (caught) {
            error = caught;
        }

        event.intercept({
            async handler() {

            }
        })

    });

    await navigation.navigate("/").finished;

    ok(eventReceived, "Event not received")
    ok(eventAsserted, error ?? "Event not asserted")

}