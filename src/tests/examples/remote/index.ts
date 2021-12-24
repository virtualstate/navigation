import {AppHistory as AppHistorySpec, AppHistoryEntry} from "../../../spec/app-history";
import {AppHistory} from "../../../app-history";
import {assert, ok} from "../../util";

// This is the extremely one to one way.. with no consideration for how these
// navigations happened
//
// Also doesn't abstract between the two with a transport later like fetch, we will
// show that later on
export async function remoteExample(appHistory: AppHistorySpec) {
    const remote = new AppHistory();

    appHistory.addEventListener("currentchange", async () => {
        const { current } = appHistory;
        if (typeof current?.url !== "string") return;
        await remote.navigate(
            current.url,
            {
                state: current.getState()
            }
        ).finished;
    });

    const expectedUrl = `/${Math.random()}`;
    const expectedState = `${Math.random()}`;
    await appHistory.navigate(expectedUrl, {
        state: {
            [expectedState]: true
        }
    }).finished;

    const { current } = remote;

    assert<AppHistoryEntry>(current);
    ok(current.url === expectedUrl);
    const state = current.getState<Record<string, unknown>>();
    assert(state[expectedState] === true);
}
