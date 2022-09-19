import {defer} from "@virtualstate/promise";
import {Navigation} from "../../../navigation";
import {NavigationSync} from "../../../history";
import {ok} from "../../util";
import {EventTargetListenersMatch} from "../../../event-target";
import {transition} from "../../../transition";

export default 1;

{
    const { resolve, promise } = defer();

    const navigation = new Navigation();

    await navigation.navigate("/").finished;

    const history = new NavigationSync({
        navigation
    });

    navigation.oncurrententrychange = resolve;

    const listeners = navigation[EventTargetListenersMatch]("currententrychange");
    console.log(listeners);
    ok(listeners.length)

    const randomData = Math.random();

    history.replaceState(randomData, "", "#1");

    await promise;

    await transition(navigation);

    const { hash } = new URL(navigation.currentEntry.url);

    ok(hash === "#1");
    ok(navigation.currentEntry.getState() === randomData);
}