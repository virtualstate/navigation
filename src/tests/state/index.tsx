import { state, setState, getState } from "../../state";
import {Router} from "../../routes";
import {getNavigation} from "../../get-navigation";
import {ok} from "../../is";
import {descendants, h} from "@virtualstate/focus";

{
    const navigation = getNavigation()

    await navigation.navigate("/").finished;

    const router = new Router(navigation);

    const { route, then } = router;

    const changes: unknown[] = []

    async function *Test() {
        for await (const change of state()) {
            console.log({ change })
            changes.push(change);
        }
    }

    route("/test",  () => (<Test />));

    // This is detaching the promise from the route transition.
    then(node => void descendants(node).catch(error => error))

    await navigation.navigate("/test").finished;

    const initialEntry = navigation.currentEntry;

    setState("Test 1");
    setState("Test 2");

    await new Promise<void>(queueMicrotask);

    setState("Test 3");

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