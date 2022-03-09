import {Navigation} from "../../spec/navigation";
import {h, toString} from "@virtualstate/fringe";
import {AsyncEventTarget} from "../../event-target";
import {ok} from "../util";

const React = {
    createElement: h
}

export async function jsxExample(navigation: Navigation) {
    interface State {
        dateTaken?: string;
        caption?: string;
    }

    function Component({ caption, dateTaken }: State, input: unknown) {
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

    const body: AsyncEventTarget & { innerHTML?: string } = new AsyncEventTarget();

    let bodyUpdated!: Promise<void>;

    navigation.addEventListener("currentchange", async (event) => {
        await (event.transitionWhile ?? (promise => promise))(bodyUpdated = handler());
        async function handler() {
            body.innerHTML = await new Promise(
                (resolve, reject) => (
                    toString(<Component {...navigation.currentEntry?.getState<State>() } />).then(
                        resolve,
                        reject
                    )
                )
            );
            console.log({ body: body.innerHTML });
        }
    });

    ok(!body.innerHTML);

    await navigation.navigate('/', {
        state: {
            dateTaken: new Date().toISOString(),
            caption: `Photo taken on the date ${new Date().toDateString()}`
        }
    }).finished;

    // console.log(body.innerHTML);
    ok(bodyUpdated);
    await bodyUpdated;

    ok(body.innerHTML);

    const updatedCaption = `Photo ${Math.random()}`;

    ok(bodyUpdated);
    await bodyUpdated;
    ok(!body.innerHTML?.includes(updatedCaption));

    await navigation.updateCurrentEntry({
        state: {
            ...navigation.currentEntry?.getState<State>(),
            caption: updatedCaption
        }
    });

    ok(bodyUpdated);
    await bodyUpdated;
    // This test will fail if async resolution is not supported.
    ok(body.innerHTML?.includes(updatedCaption));

}