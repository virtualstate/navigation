import { Navigation } from "../../navigation";
import { Router } from "../../routes";
import { children, h, name, properties } from "@virtualstate/focus";
import { defer } from "@virtualstate/promise";
import { ok } from "../util";

declare global {
  namespace JSX {
    interface IntrinsicElements
      extends Record<string, Record<string, unknown>> {}
  }
}

{
  interface State {
    title: string;
    content: string;
  }

  const navigation = new Navigation<State>();
  const { route, then } = new Router<State>(navigation);

  const { resolve: render, promise } = defer<unknown>();

  route(
    "/post/:id",
    (
      { destination },
      {
        pathname: {
          groups: { id },
        },
      }
    ) => {
      const state = destination.getState();
      return (
        <main>
          <meta name="id" value={id} />
          <h1>{state.title}</h1>
          <p>{state.content}</p>
        </main>
      );
    }
  );

  then(render);

  const id = `${Math.random()}`;

  navigation.navigate(`/post/${id}`, {
    state: {
      title: "Hello!",
      content: "Here is some content for ya!",
    },
  });

  const [node] = await Promise.all([promise, navigation.transition?.finished]);

  console.log({ node });

  ok(node);
  ok(name(node) === "main");

  const {
    h1: [h1],
    p: [p],
    meta: [meta],
  } = children(node).group(name);

  const idMeta = properties(await meta);

  ok(idMeta);

  ok(idMeta.name === "id");
  ok(idMeta.value === id);

  const [h1Text] = await children(h1);
  const [pText] = await children(p);

  console.log({
    h1Text,
    pText,
    idMeta,
  });

  ok(h1Text);
  ok(pText);

  const state: State = navigation.currentEntry.getState();

  ok(state);

  ok(h1Text === state.title);
  ok(pText === state.content);
}
