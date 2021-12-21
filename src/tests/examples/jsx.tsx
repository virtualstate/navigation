import {AppHistory} from "../../app-history.prototype";
import {h, toString, VNode} from "@virtualstate/fringe";
import {EventTarget} from "@opennetwork/environment";
import {ok} from "../util";

export async function jsxExample(appHistory: AppHistory) {
    interface State {
        dateTaken?: string;
        caption?: string;
    }

    function Component({ caption, dateTaken }: State, input?: VNode) {
        return h(
            "figure",
            {},
            h("date", {}, dateTaken),
            h("figcaption", {}, caption),
            input
        )
        // return (
        //     <figure>
        //         <date>{dateTaken}</date>
        //         <figcaption>{caption}</figcaption>
        //         {input}
        //     </figure>
        // )
    }

    const body: EventTarget & { innerHTML?: string } = new EventTarget();

    appHistory.addEventListener("currentchange", async (event) => {
        await (event.transitionWhile ?? (promise => promise))(handler());
        async function handler() {
            body.innerHTML = await toString(<Component {...appHistory.current.getState<State>() } />)
        }
    });

    ok(!body.innerHTML);

    await appHistory.navigate('/', {
        state: {
            dateTaken: new Date().toISOString(),
            caption: `Photo taken on the date ${new Date().toDateString()}`
        }
    }).finished;

    ok(body.innerHTML);

    const updatedCaption = `Photo ${Math.random()}`;

    ok(!body.innerHTML.includes(updatedCaption));

    await appHistory.updateCurrent({
        state: {
            ...appHistory.current.getState<State>(),
            caption: updatedCaption
        }
    })
        // Not all implementations have support for async resolution
        ?.finished;

    // This test will fail if async resolution is not supported.
    ok(body.innerHTML.includes(updatedCaption));

}