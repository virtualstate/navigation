import {AppHistory, AppHistoryNavigateEvent} from "../../spec/app-history";
import {ok} from "../util";

export async function hashChangeExample(appHistory: AppHistory) {
    const navigate = new Promise<AppHistoryNavigateEvent>((resolve, reject) => {
        appHistory.addEventListener("navigate", resolve);
        appHistory.addEventListener("navigateerror", event => reject(event.error));
    });

    const expectedHash = `#h${Math.random()}`;

    await appHistory.navigate(expectedHash);
    const event = await navigate;

    ok(event);
    ok(event.hashChange);

    ok(appHistory.current.url);
    // console.log(appHistory.current.url);
    ok(new URL(appHistory.current.url).hash);
    ok(new URL(appHistory.current.url).hash === expectedHash);
}