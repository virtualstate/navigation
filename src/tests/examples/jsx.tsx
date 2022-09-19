import { Navigation } from "../../spec/navigation";
import { AsyncEventTarget } from "../../event-target";
import { ok } from "../util";
import { h } from "@virtualstate/focus/static-h";
import { toKDLString } from "@virtualstate/kdl";

const React = {
  createElement: h,
};

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
    );
    // return (
    //     <figure>
    //         <date>{dateTaken}</date>
    //         <figcaption>{caption}</figcaption>
    //         {input}
    //     </figure>
    // )
  }

  const body: AsyncEventTarget & { innerKDL?: string } = new AsyncEventTarget();

  let bodyUpdated!: Promise<void>;

  navigation.addEventListener("currentchange", async (event) => {
    await (event.intercept ?? ((promise) => promise))(
      (bodyUpdated = handler())
    );
    async function handler() {
      body.innerKDL = await new Promise((resolve, reject) =>
        toKDLString(
          <Component {...navigation.currentEntry?.getState<State>()} />
        ).then(resolve, reject)
      );
      console.log({ body: body.innerKDL });
    }
  });

  ok(!body.innerKDL);

  await navigation.navigate("/", {
    state: {
      dateTaken: new Date().toISOString(),
      caption: `Photo taken on the date ${new Date().toDateString()}`,
    },
  }).finished;

  // console.log(body.innerHTML);
  ok(bodyUpdated);
  await bodyUpdated;

  ok(body.innerKDL);

  const updatedCaption = `Photo ${Math.random()}`;

  ok(bodyUpdated);
  await bodyUpdated;
  ok(!body.innerKDL?.includes(updatedCaption));

  await navigation.updateCurrentEntry({
    state: {
      ...navigation.currentEntry?.getState<State>(),
      caption: updatedCaption,
    },
  });

  ok(bodyUpdated);
  await bodyUpdated;
  // This test will fail if async resolution is not supported.
  ok(body.innerKDL?.includes(updatedCaption));
}
