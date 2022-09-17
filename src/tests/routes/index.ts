import {getRouter, route, Router, routes} from "../../routes";
import { Navigation } from "../../navigation";
import { ok } from "../util";
import {getNavigation} from "../../get-navigation";

{

    const navigation = new Navigation();
    const { finished } = navigation.navigate("/");
    await finished;

    const router = new Router(navigation);

    router.route("/", () => {
        console.log("main");
    })

    router.route("/test", () => {
        console.log("test");
    });

    router.route("/resource/:id", async (event, match) => {
        const {
            pathname: {
                groups: {
                    id
                }
            }
        } = match
        console.log("start resource", { id })
        await new Promise(resolve => setTimeout(resolve, 10));
        console.log("done resource", { id })
    });

    router.navigate("/test");
    router.navigate("/");
    router.navigate("/test");
    router.navigate("/resource/1");

    await router.transition?.finished

    console.log("finished first round");

    // router is a navigation, so it can be shared
    // note, navigation in one, navigates the other
    const another = new Router(router);

    another.navigate("/resource/2");

    await router.transition?.finished

    ok(another.currentEntry.url === router.currentEntry.url)

    console.log("finished second round");

    {

        const navigation = new Navigation();
        navigation.navigate("/");
        await navigation.transition?.finished

        const third = new Router(navigation);

        // This copies the routes over, allowing separate navigation
        third.routes(router);

        third.navigate("/resource/3");

        await third.transition?.finished

        ok(third.currentEntry.url !== router.currentEntry.url)
    }
}

{
    // In one context define the routes
    {
        route("/resource/:id", async (event, match) => {
            const {
                pathname: {
                    groups: {
                        id
                    }
                }
            } = match
            console.log("start resource", { id })
            await new Promise<void>(queueMicrotask);
            console.log("done resource", { id, aborted: event.signal.aborted })
        });
    }

    // In another context, navigate & use the router
    {
        const router = getNavigation();

        await router.navigate("/resource/1").finished;
        await router.navigate("/resource/2").finished;
        await router.navigate("/resource/3").finished;

        // These two are aborted before finishing
        router.navigate("/resource/1");
        router.navigate("/resource/2");

        await router.navigate("/resource/3").finished;
    }

}

{
    route("/test/:id/path", async (event, { pathname: { groups: { id } } }) => {
        console.log("test route path!", id);
        await new Promise<void>(queueMicrotask);
        console.log("thing is happening for", id);
        await new Promise<void>(queueMicrotask);
        console.log("thing finished for", id);
    })

    {
        const navigation = getNavigation();

        console.log("Starting navigation");
        await navigation.navigate(`/test/${Math.random()}/path`).finished;
        console.log("Finished navigation");
    }
}

{

    const router = new Router(
        new Navigation()
    );

    router.catch(error => {
        console.error(error);
    })

    router.route("/", () => {
        throw new Error("Error");
    })

    await router.navigate("/").finished;


}

{
    {
        {
            routes()
                .catch((error, { destination: { url }}) => {
                    console.error(`Error for ${url}`);
                    console.error(error);
                })
                .route(() => {
                    throw new Error("Error")
                })
        }


        {

            const navigation = getNavigation();
            await navigation.navigate(`/path/${Math.random()}`).finished;

        }


    }
}