import { state, setState } from "../../state";
import {Router} from "../../routes";
import {ok} from "../../is";
import {descendants, h} from "@virtualstate/focus";
import {Navigation} from "../../navigation";
import {transition} from "../../transition";
import {getNavigation} from "../../get-navigation";
import {isWindowNavigation} from "../util";

if (!isWindowNavigation(getNavigation())) {
    const navigation = getNavigation()

    await navigation.navigate("/").finished;

    const router = new Router(navigation);

    const { route, then } = router;

    const changes: unknown[] = []

    async function *Test() {
        console.log("Test start");
        for await (const change of state()) {
            console.log({ change })
            changes.push(change);
        }
        console.log("Test end");
    }

    route("/test-state",  () => (<Test />));

    // This is detaching the promise from the route transition.
    then(node => void descendants(node).catch(error => error))

    console.log("Navigate /test-state");
    await navigation.navigate("/test-state").finished;

    const initialEntry = navigation.currentEntry;

    setState("Test 1");
    setState("Test 2");

    await new Promise<void>(queueMicrotask);

    setState("Test 3");

    await new Promise(resolve => setTimeout(resolve, 100));

    console.log("Navigate /another");
    await navigation.navigate("/another").finished;

    const nextEntry = navigation.currentEntry;

    // Should be setting the next entry
    setState("Test 4");

    ok(nextEntry.id !== initialEntry.id, "Expected entry id not to match");
    ok(nextEntry.getState() !== initialEntry.getState(), "Expected state to be different");

    router.detach();

    ok(changes.length === 3);
    ok(changes[0] === "Test 1");
    ok(changes[1] === "Test 2");
    ok(changes[2] === "Test 3");


}

{

    const navigation = new Navigation()

    await navigation.navigate("/").finished;

    const router = new Router(navigation);

    const { route, then } = router;

    const changes: unknown[] = []

    const entryChange = state(navigation);

    async function *Test() {
        console.log("Test start");
        for await (const change of entryChange) {
            console.log({ change })
            changes.push(change);
        }
        console.log("Test end");
    }

    route("/*", () => {
        return "Default";
    })

    route("/test-route", () => {
        return "test"
    })

    route("/route",  () => {
        console.log("/route");
        return <Test />
    });

    // This is detaching the promise from the route transition.
    then(node => void descendants(node).catch(error => error))

    await navigation.navigate("/route").finished;

    const initialEntry = navigation.currentEntry;

    navigation.updateCurrentEntry({
        state: "Test 1"
    });
    navigation.updateCurrentEntry({
        state: "Test 2"
    });

    await new Promise<void>(queueMicrotask);

    navigation.updateCurrentEntry({
        state: "Test 3"
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    await navigation.navigate("/another").finished;

    const nextEntry = navigation.currentEntry;

    // Should be setting the next entry
    navigation.updateCurrentEntry({
        state: "Test 4"
    });

    ok(nextEntry.id !== initialEntry.id);
    ok(nextEntry.getState() !== initialEntry.getState());

    {
        ok(changes.length === 3);
        ok(changes[0] === "Test 1");
        ok(changes[1] === "Test 2");
        ok(changes[2] === "Test 3");
    }

    await navigation.navigate("/test-route").finished;

    {
        ok(changes.length === 3);
    }

    console.log("Navigating to /route");

    await navigation.navigate("/route").finished;

    navigation.updateCurrentEntry({
        state: "Test 5"
    });
    navigation.updateCurrentEntry({
        state: "Test 6"
    });

    navigation.updateCurrentEntry({
        state: "Test 7"
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    await navigation.navigate("/").finished;

    console.log(changes);
    {
        ok(changes.length > 3);
        ok(changes.at(-1) === "Test 7");
    }

}


{
    const navigation = new Navigation();

    await navigation.navigate("/", { }).finished;

    const changes = state(navigation);

    const controller = new AbortController();

    async function app(): Promise<void> {
        for await (const change of changes) {
            console.log({ change });
        }
    }

    navigation.addEventListener("navigate", event => event.intercept({
        handler: () => void app()
    }));

    // The below is "simulating" navigation, without watching
    // what effects happen from it, in real apps this would be happening
    // all over the place
    // Some state might be missed if it is immediately updated during
    // or right after a transition

    navigation.navigate("/a", { state: "Loading!" });

    await transition(navigation);
    await new Promise(resolve => setTimeout(resolve, 10));

    navigation.updateCurrentEntry({ state: "Value!" });

    await transition(navigation)
    await new Promise(resolve => setTimeout(resolve, 10));

    navigation.navigate("/a/route", { state: "Some other value" });

    await transition(navigation);
    await new Promise(resolve => setTimeout(resolve, 10));

    navigation.updateCurrentEntry({ state: "Updated value!" });

    await transition(navigation);
    await new Promise(resolve => setTimeout(resolve, 10));

    controller.abort();


}
