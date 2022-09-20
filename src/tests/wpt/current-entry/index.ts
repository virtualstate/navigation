import {Navigation} from "../../../navigation";
import {NavigationSync} from "../../../history";
import {ok} from "../../util";
import {transition} from "../../../transition";

export default 1;

{
    interface State {
        key: string;
    }

    const navigation = new Navigation<State>();

    await navigation.navigate("/").finished;

    const history = new NavigationSync({
        navigation
    });

    ok(!history.state);

    const newState = {
        key: `${Math.random()}`
    }

    navigation.updateCurrentEntry({ state: newState });

    const state = navigation.currentEntry.getState();

    console.log({ state });

    ok(state);
    ok(state.key === newState.key);
    ok(state !== newState); // Should be cloning our state object

    // updateCurrentEntry should have no effect on history.state
    ok(!history.state);

    await transition(navigation);

}