import { getRouter, route, Router, routes } from "../../routes";
import {NavigateEvent, Navigation} from "../../navigation";
import { ok } from "../util";
import { getNavigation } from "../../get-navigation";

const navigation = getNavigation();

{
  const navigation = new Navigation();
  const { finished } = navigation.navigate("/");
  await finished;

  const router = new Router(navigation);

  router.route("/", () => {
    console.log("main");
  });

  router.route("/test", () => {
    console.log("test");
  });

  router.route("/resource/:id", async (event, match) => {
    const {
      pathname: {
        groups: { id },
      },
    } = match;
    console.log("start resource", { id });
    await new Promise((resolve) => setTimeout(resolve, 10));
    console.log("done resource", { id });
  });

  navigation.navigate("/test");
  navigation.navigate("/");
  navigation.navigate("/test");
  navigation.navigate("/resource/1");

  await navigation.transition?.finished;

  console.log("finished first round");

  // router is a navigation, so it can be shared
  // note, navigation in one, navigates the other
  const another = new Router(navigation);

  navigation.navigate("/resource/2");

  await navigation.transition?.finished;

  console.log("finished second round");
  ok(navigation.currentEntry.url.endsWith("/resource/2"));

  {
    const navigation = new Navigation();
    navigation.navigate("/");
    await navigation.transition?.finished;

    const third = new Router(navigation);

    // This copies the routes over, allowing separate navigation
    third.routes(router);

    navigation.navigate("/resource/3");

    await navigation.transition?.finished;

    ok(navigation.currentEntry.url.endsWith("/resource/3"));
  }

  ok(!navigation.currentEntry.url.endsWith("/resource/3"));
  ok(navigation.currentEntry.url.endsWith("/resource/2"));
}

{
  let detach;

  // In one context define the routes
  {
    ({ detach } = route("/resource/:id", async (event, match) => {
      const {
        pathname: {
          groups: { id },
        },
      } = match;
      console.log("start resource", { id });
      await new Promise<void>(queueMicrotask);
      console.log("done resource", { id, aborted: event.signal.aborted });
    }));
  }

  // In another context, navigate & use the router
  {
    await navigation.navigate("/resource/1").finished;
    await navigation.navigate("/resource/2").finished;
    await navigation.navigate("/resource/3").finished;

    // These two are aborted before finishing
    navigation.navigate("/resource/1");
    navigation.navigate("/resource/2");

    await navigation.navigate("/resource/3").finished;
  }

  detach();
}

{
  const { detach } = route(
    "/test/:id/path",
    async (
      event,
      {
        pathname: {
          groups: { id },
        },
      }
    ) => {
      console.log("test route path!", id);
      await new Promise<void>(queueMicrotask);
      console.log("thing is happening for", id);
      await new Promise<void>(queueMicrotask);
      console.log("thing finished for", id);
    }
  );

  {
    console.log("Starting navigation");
    await navigation.navigate(`/test/${Math.random()}/path`).finished;
    console.log("Finished navigation");
  }

  detach();
}

{
  const navigation = new Navigation();
  const router = new Router(navigation);

  router.catch((error) => {
    console.error(error);
  });

  router.route("/", () => {
    throw new Error("Error");
  });

  await navigation.navigate("/").finished;
}

{
  {
    let detach;

    {
      ({ detach } = routes()
        .route(() => {
          throw new Error("Error");
        })
        .catch((error, { destination: { url } }) => {
          console.error(`Error for ${url}`);
          console.error(error);
        }));
    }

    {
      await navigation.navigate(`/path/${Math.random()}`).finished;
    }

    // After detach, the router will no longer respond the top level
    // navigation events
    detach();
  }
}
{
  {
    let detach;

    {
      ({ detach } = routes()
        .route(
          "/path/:id",
          (
            event,
            {
              pathname: {
                groups: { id },
              },
            }
          ) => {
            throw new Error(`Error for id path ${id}`);
          }
        )
        .route("/test", () => {
          throw new Error("Error for test path");
        })
        .catch(
          "/path/:id",
          (
            error,
            { destination: { url } },
            {
              pathname: {
                groups: { id },
              },
            }
          ) => {
            console.error(`Error for ${url} in id ${id} path handler`);
            console.error(error);
          }
        )
        .catch("/test", (error, { destination: { url } }) => {
          console.error(`Error for ${url} in test handler`);
          console.error(error);
        }));
    }

    {
      await navigation.navigate(`/path/${Math.random()}`).finished;
      await navigation.navigate(`/test`).finished;
    }

    detach();
  }
}

{
  interface State {
    key: number;
  }

  const navigation = new Navigation<State>();
  const { route, then } = new Router<NavigateEvent<State>>(navigation);

  let setValue: unknown = undefined;

  route("/path", async ({ destination }) => {
    console.log("In path route handler");
    const state = destination.getState();
    console.log({ state });
    return state.key;
  });

  then("/path", (value) => {
    console.log("In path result handler", { value });
    setValue = value;
  });

  const value = Math.random();

  ok(!setValue);

  await navigation.navigate("/path", {
    state: {
      key: value,
    },
  }).finished;

  ok(setValue);
  ok(setValue === value);
}

await import("./jsx");
