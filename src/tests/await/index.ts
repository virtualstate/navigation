import {isWindowNavigation} from "../util";
import {getNavigation} from "../../get-navigation";
import {currentEntryChange, intercept, navigate, navigateSuccess} from "../../await";
import {defer} from "../../defer";
import {Navigation} from "../../navigation";

if (!isWindowNavigation(getNavigation())) {

    const navigation = getNavigation()


    async function app() {

        console.log("Waiting for navigate");

        await Promise.all([
            navigate,
            currentEntryChange
        ]);
    }

    const promise = app().catch(console.error);

    console.log("navigate");
    await new Promise(resolve => {
        queueMicrotask(() => {
            navigation.navigate("/").finished.then(resolve)
        })
    });

    await promise;

    console.log("Done");

}

{
    const navigation = new Navigation()

    const promise = intercept({
        async handler() {
            // Do every navigate loading, refresh indicator is spinning
            // Url might change during this time
        },
        commit: "after-transition"
    }, navigation);

    async function page() {

        const { commit } = await promise;

        // Do extra content loading, refresh indicator is spinning
        // Url has not changed

        // Setting to manual allows us to control when the url and entry actually changes
        commit();

        // Do after content loaded, refresh indicator is not spinning
        // Url has changed

    }

    const pagePromise = page();

    // Will happen at some other time
    await new Promise(resolve => {
        queueMicrotask(() => {
            navigation.navigate("/").finished.then(resolve)
        })
    });

    await pagePromise;

}