import {Navigation} from "../navigation";
import {ok} from "../is";

{
    const sessionStorageMap = new Map();

    const navigation = new Navigation({
        getState({ id }) {
            console.log("getState");
            const maybe = sessionStorageMap.get(id);
            if (!maybe) return undefined; // Or can return null here
            return maybe
        },
        setState(entry) {
            console.log("setState");
            const state = entry.getState();
            const { id } = entry;
            sessionStorageMap.set(id, state);
        },
        disposeState({ id }) {
            console.log("disposeState");
            sessionStorageMap.delete(id);
        }
    })

    ok(!sessionStorageMap.size);

    const initialState = `Test ${Math.random()}`;
    const { id: initialId } = await navigation.navigate("/1", {
        state: initialState
    }).finished;

    ok(sessionStorageMap.size);
    const storedValue = sessionStorageMap.get(initialId);
    ok(storedValue === initialState);

    const nextState = `Another ${Math.random()}`;
    const { id: nextId, key: nextKey } = await navigation.navigate("/2", {
        state: nextState
    }).finished;
    ok(sessionStorageMap.size === 2);
    const nextStoredValue = sessionStorageMap.get(nextId);
    ok(nextStoredValue === nextState);

    const { id: finalId, key: finalKey } = await navigation.navigate("/2", {
        state: Math.random(),
        history: "replace"
    }).finished;
    ok(nextKey === finalKey);
    ok(nextId !== finalId);
    ok(sessionStorageMap.size === 2);
    ok(sessionStorageMap.has(initialId));
    ok(!sessionStorageMap.has(nextId));
    ok(sessionStorageMap.has(finalId));
}