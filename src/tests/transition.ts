import {Navigation} from "../navigation";
import {transition} from "../transition";
import {ok} from "./util";

{
    const navigation = new Navigation();

    navigation.navigate("/a"); // This one should be cancelled

    const promise = transition(navigation);

    navigation.navigate("/b"); // This one should be the final entry

    // This should resolve all transitions, so should wait until /b
    await promise;

    console.log(navigation.currentEntry);
    ok(navigation.currentEntry.url.endsWith("/b"));

}

{
    const navigation = new Navigation();

    navigation.addEventListener("navigate", event => event.intercept({
        handler: () => new Promise(resolve => setTimeout(resolve, 10))
    }));

    navigation.navigate("/a"); // This one should be cancelled
    navigation.navigate("/b"); // This one should be cancelled


    queueMicrotask(() => {
        navigation.navigate("/c"); // This one should be the final entry
    })

    await transition(navigation);

    console.log(navigation.currentEntry);
    ok(navigation.currentEntry.url.endsWith("/c"));


}

{


    const navigation = new Navigation();

    navigation.navigate("/initial");

    await transition(navigation);

    navigation.addEventListener("navigate", event => event.preventDefault());

    navigation.navigate("/a"); // This one should be cancelled
    navigation.navigate("/b"); // This one should be cancelled
    navigation.navigate("/c"); // This one should be the final entry

    await transition(navigation);

    console.log(navigation.currentEntry);
    ok(navigation.currentEntry.url.endsWith("/initial"));


}
{
    const navigation = new Navigation<{ withState: true }>()

    await transition(navigation);
}