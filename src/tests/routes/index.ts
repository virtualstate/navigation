import {route, router, Router} from "../../routes";
import { Navigation } from "../../navigation";
import { ok } from "../util";

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
    route("/resource/:id", async (event, match) => {
        const {
            pathname: {
                groups: {
                    id
                }
            }
        } = match
        console.log("start resource", { id })
        await new Promise(resolve => setTimeout(resolve, 10));
        console.log("done resource", { id, aborted: event.signal.aborted })
    });

    await router.navigate("/resource/1").finished;
    await router.navigate("/resource/2").finished;
    await router.navigate("/resource/3").finished;

    // These two are aborted before finishing
    router.navigate("/resource/1");
    router.navigate("/resource/2");

    await router.navigate("/resource/3").finished;

}