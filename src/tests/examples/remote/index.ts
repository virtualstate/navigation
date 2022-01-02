import {AppHistory as AppHistorySpec, AppHistoryEntry} from "../../../spec/app-history";
import {AppHistory} from "../../../app-history";
import {assert, isWindowAppHistory, ok} from "../../util";
import {addEventListener} from "../../../event-target/global";
import {Response} from "@opennetwork/http-representation";
import {fetch} from "../fetch";

// This is the extremely one to one way.. with no consideration for how these
// navigations happened
//
// Also doesn't abstract between the two with a transport later like fetch, we will
// show that later on
export async function remoteExample(appHistory: AppHistorySpec) {
    if (typeof window !== "undefined") return;

    const remote = new AppHistory();

    appHistory.addEventListener("currentchange", async () => {
        const { current } = appHistory;
        if (typeof current?.url !== "string") return;
        const { committed, finished } = remote.navigate(
            current.url,
            {
                state: current.getState()
            }
        );
        await Promise.all([committed, finished]);
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

// Step 2, abstract across fetch
export async function remoteFetchExample(appHistory: AppHistorySpec) {
    if (typeof window !== "undefined") return;

    const remote = new AppHistory();

    addEventListener("fetch", async ({ request, respondWith }) => {
        const body = await request.json();
        const { pathname } = new URL(request.url);
        const { committed, finished } = remote.navigate(
            pathname,
            {
                state: body
            }
        );
        await Promise.all([committed, finished]);
        return respondWith(new Response("", { status: 200 }));
    })

    appHistory.addEventListener("currentchange", async () => {
        const { current } = appHistory;
        if (typeof current?.url !== "string") return;
        const response = await fetch(current.url, {
            method: "post",
            body: JSON.stringify(current.getState())
        });
        if (!response.ok) throw new Error("Something went wrong");
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
