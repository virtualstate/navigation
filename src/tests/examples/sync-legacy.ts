import { AppHistory } from "../../spec/app-history";
import { AppHistorySync } from "../../history";
import {ok} from "../util";

export async function syncLocationExample(appHistory: AppHistory) {
    const sync = new AppHistorySync({ appHistory }),
        location: Location = sync;

    const expectedHash = `#hash${Math.random()}`;

    location.hash = expectedHash;
    ok(location.hash === expectedHash);

    await finished(appHistory);

    const expectedPathname = `/pathname/1/${Math.random()}`;
    location.pathname = expectedPathname;
    ok(location.pathname === expectedPathname);

    await finished(appHistory);

    const searchParams = new URLSearchParams(location.search);
    searchParams.append("test", "test");
    location.search = searchParams.toString();
    ok(new URLSearchParams(location.search).get("test") === "test");

    await finished(appHistory);
}

export async function syncHistoryExample(appHistory: AppHistory) {
    const sync = new AppHistorySync({ appHistory }),
        history: History = sync;

    const expected = `expected${Math.random()}`;
    const expectedUrl = new URL(`https://example.com/${expected}/1`)
    history.pushState({
        [expected]: expected
    }, "", expectedUrl);
    ok(history.state[expected] === expected);

    await finished(appHistory);

    ok(appHistory.current.url === expectedUrl.toString());

    await appHistory.navigate("/1").finished;
    ok(history.state[expected] !== expected);
    await appHistory.navigate("/2").finished;
    await appHistory.navigate("/3").finished;

    history.back();

    await finished(appHistory);
    ok(history.state[expected] !== expected);

    history.back();

    await finished(appHistory);
    ok(history.state[expected] !== expected);

    history.back();

    await finished(appHistory);

    ok(history.state[expected] === expected);
    ok(appHistory.current.url === expectedUrl.toString());

    history.forward();

    await finished(appHistory);
    ok(history.state[expected] !== expected);

    history.go(-1);

    await finished(appHistory);
    ok(history.state[expected] === expected);

    history.go(1);

    await finished(appHistory);
    ok(history.state[expected] !== expected);

    history.go(-1);

    await finished(appHistory);
    ok(history.state[expected] === expected);

    history.go(0);

    await finished(appHistory);
    ok(history.state[expected] === expected);




}

async function finished(appHistory: AppHistory) {
    ok(appHistory.transition);
    ok(appHistory.transition.finished);
    await appHistory.transition.finished;
}