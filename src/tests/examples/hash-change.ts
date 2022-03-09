import {Navigation, NavigateEvent} from "../../spec/navigation";
import {ok} from "../util";

export async function hashChangeExample(navigation: Navigation) {
    const navigate = new Promise<NavigateEvent>((resolve, reject) => {
        navigation.addEventListener("navigate", resolve);
        navigation.addEventListener("navigateerror", event => reject(event.error));
    });

    const expectedHash = `#h${Math.random()}`;

    await navigation.navigate(expectedHash);
    const event = await navigate;

    ok(event);
    ok(event.hashChange);

    ok(navigation.currentEntry.url);
    // console.log(navigation.current.url);
    ok(new URL(navigation.currentEntry.url).hash);
    ok(new URL(navigation.currentEntry.url).hash === expectedHash);
}