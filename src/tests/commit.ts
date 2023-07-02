import {Navigation} from "../navigation";
import {ok} from "../is";
import {defer} from "../defer";
import {Event} from "../event-target";

/**
 * @experimental
 */
{
    const navigation = new Navigation();

    await navigation.navigate("/").finished;

    navigation.addEventListener("navigate", event => {
        console.log(event);
        console.log(navigation.currentEntry);
        event.intercept({ commit: "after-transition" });
        event.commit();
        console.log(navigation.currentEntry);
    });

    navigation.navigate("/1");

    // await new Promise<void>(queueMicrotask);
    // await new Promise<void>(queueMicrotask);
    //
    const { pathname } = new URL(navigation.currentEntry.url);

    console.log({ pathname });

    ok(pathname === "/1");


}
/**
 * @experimental
 */
{
    const navigation = new Navigation();

    await navigation.navigate("/").finished;

    const errorMessage = `Custom error ${Math.random()}`;

    const { resolve, promise } = defer<Event & { error?: unknown }>();

    navigation.addEventListener("navigateerror", resolve, { once: true });

    navigation.addEventListener("navigate", event => {
        event.intercept({ commit: "after-transition" });
        event.reportError(new Error(errorMessage))
    });

    const { committed, finished } = navigation.navigate("/1")

    const [
        committedError,
        finishedError
    ] = await Promise.all([
        committed.catch(error => error),
        finished.catch(error => error)
    ]);

    const { error } = await promise;

    console.log({
        error
    });

    ok(error instanceof Error);
    ok(error.message === errorMessage);
    ok(committedError instanceof Error);
    ok(committedError.message === errorMessage);
    ok(finishedError instanceof Error);
    ok(finishedError.message === errorMessage);
    ok(committedError === error);
    ok(finishedError === error);

}


/**
 * @experimental
 */
{
    const navigation = new Navigation();

    await navigation.navigate("/").finished;

    const errorMessage = `Custom error ${Math.random()}`;

    const { resolve, promise } = defer<Event & { error?: unknown }>();

    navigation.addEventListener("navigateerror", resolve, { once: true });

    navigation.addEventListener("navigate", event => {
        event.intercept(async () => {
            await new Promise<void>(queueMicrotask);
            event.reportError(new Error(errorMessage))
        });
    });

    const { committed, finished } = navigation.navigate("/1")

    const [
        committedError,
        finishedError
    ] = await Promise.all([
        committed.catch(error => error),
        finished.catch(error => error)
    ]);

    const { error } = await promise;

    console.log({
        error
    });

    ok(error instanceof Error);
    ok(error.message === errorMessage);
    // we should be committing fine
    ok(!(committedError instanceof Error));
    ok(finishedError instanceof Error);
    ok(finishedError.message === errorMessage);
    ok(finishedError === error);

}

