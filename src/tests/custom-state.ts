import {Navigation} from "../navigation";
import {ok} from "../is";

{
    const sessionStorageMap = new Map();

    const navigation = new Navigation({
        getState({ key }) {
            console.log("getState");
            const maybe = sessionStorageMap.get(this.id);
            if (!maybe) return undefined; // Or can return null here
            return maybe
        },
        setState(entry) {
            console.log("setState");
            const state = entry.getState();
            const { key } = entry;
            sessionStorageMap.set(key, state);
        },
        disposeState({ key }) {
            console.log("disposeState");
            sessionStorageMap.delete(key);
        }
    })

    ok(!sessionStorageMap.size);

    const initialState = `Test ${Math.random()}`;
    const { key: initialKey } = await navigation.navigate("/1", {
        state: initialState
    }).finished;

    ok(sessionStorageMap.size);
    const storedValue = sessionStorageMap.get(initialKey);
    ok(storedValue === initialState);

    const nextState = `Another ${Math.random()}`;
    const { key: nextKey} = await navigation.navigate("/2", {
        state: nextState
    }).finished;
    ok(sessionStorageMap.size === 2);
    const nextStoredValue = sessionStorageMap.get(nextKey);
    ok(nextStoredValue === nextState);

    const { key: finialKey } = await navigation.navigate("/2", {
        state: Math.random(),
        history: "replace"
    }).finished;
    ok(sessionStorageMap.size === 2);
    ok(sessionStorageMap.has(initialKey));
    ok(!sessionStorageMap.has(nextKey));
    ok(sessionStorageMap.has(finialKey));
}