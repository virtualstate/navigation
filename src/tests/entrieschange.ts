import {Navigation, NavigationEntriesChangeEvent} from "../navigation";
import {ok} from "../is";
import {remove} from "cheerio/lib/api/manipulation";

async function getChanges(navigation: Navigation) {
    return new Promise<NavigationEntriesChangeEvent>(
        resolve => navigation.addEventListener("entrieschange", resolve, { once: true })
    );
}


{
    const navigation = new Navigation();
    const promise = getChanges(navigation);

    const entry = await navigation.navigate("/").finished;

    const {
        addedEntries,
        removedEntries,
        updatedEntries
    } = await promise;

    console.log({
        addedEntries,
        removedEntries,
        updatedEntries
    })

    ok(addedEntries.length === 1);
    ok(removedEntries.length === 0);
    ok(updatedEntries.length === 0);

    ok(addedEntries[0].key === entry.key);
}

{

    const navigation = new Navigation();
    const initial = await navigation.navigate("/").finished;
    const next = await navigation.navigate("/next").finished;

    let called = false;
    navigation.addEventListener("entrieschange", () => called = true, { once: true });

    await navigation.back().finished;

    ok(!called); // No changes to entries
    ok(navigation.currentEntry.key === initial.key);

    {
        const entries = navigation.entries();

        ok(entries.length >= 2);
        ok(entries[navigation.currentEntry.index].key === initial.key);

        // The entry is still the same, just shifted index
        ok(entries[navigation.currentEntry.index + 1]);
        ok(entries[navigation.currentEntry.index + 1].key === next.key);

        called = false;
        navigation.addEventListener("entrieschange", () => called = true, { once: true });

    }

    {
        await navigation.forward().finished;

        ok(!called); // No changes to entries
        ok(navigation.currentEntry.key === next.key);

        const entries = navigation.entries();

        ok(entries.length >= 2);
        ok(entries[navigation.currentEntry.index].key === next.key);

        // The entry is still the same, just shifted index
        ok(entries[navigation.currentEntry.index - 1]);
        ok(entries[navigation.currentEntry.index - 1].key === initial.key);
    }

}

{
    const navigation = new Navigation();
    const initial = await navigation.navigate("/").finished;
    const next = await navigation.navigate("/next").finished;

    let called = false;
    navigation.addEventListener("entrieschange", () => called = true, { once: true });

    await navigation.traverseTo(initial.key).finished;

    ok(!called); // No changes yet, just a traverse

    const promise = getChanges(navigation);

    const pushed = await navigation.navigate("/pushed").finished;

    const {
        addedEntries,
        removedEntries,
        updatedEntries
    } = await promise;

    console.log({
        addedEntries,
        removedEntries,
        updatedEntries
    })

    ok(addedEntries.length === 1);
    ok(removedEntries.length === 1);
    ok(updatedEntries.length === 0);

    ok(addedEntries[0].key === pushed.key);
    ok(removedEntries[0].key === next.key);

}