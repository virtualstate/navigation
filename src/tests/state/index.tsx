import { state, setState, getState } from "../../state";
import {Router} from "../../routes";
import {getNavigation} from "../../get-navigation";
import {ok} from "../../is";
import {descendants, h} from "@virtualstate/focus";
import {Navigation} from "../../navigation";

{
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

    route("/test",  () => (<Test />));

    // This is detaching the promise from the route transition.
    then(node => void descendants(node).catch(error => error))

    console.log("Navigate /test");
    await navigation.navigate("/test").finished;

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

    ok(nextEntry.id !== initialEntry.id);
    ok(nextEntry.getState() !== initialEntry.getState());

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

    await navigation.navigate("/test").finished;

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
