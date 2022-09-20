import {Navigation} from "../navigation";
import {ok} from "../is";

/**
 * @experimental
 */
{
    const navigation = new Navigation();

    await navigation.navigate("/").finished;

    navigation.addEventListener("navigate", event => {
        console.log(event);
        console.log(navigation.currentEntry);
        event.intercept({ commit: "manual" });
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

