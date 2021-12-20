import { AppHistory } from "./app-history";
import {
    run,
    addEventListener,
    getStore,
    setEnvironmentConfig,
    FSStore
} from "@opennetwork/environment";
import { promises } from "fs";

const cache = new FSStore<string>({
    space: '  ',
    replacer: undefined,
    interface: {
        promises
    }
});

async function getFromCache(key: string) {
    try {
        return await cache.get(key);
    } catch {
        return undefined;
    }
}

const storeKey = "./node_modules/.store";
const appHistory = new AppHistory();

addEventListener("configure", async () => {

    await setEnvironmentConfig({

    })

    const stored = await getFromCache(storeKey);
    if (isEntries(stored)) {
        const store = getStore();
        for (const [key, value] of stored) {
            await store.set(key, value);
        }
    }
    function isEntries(stored: unknown): stored is [string, unknown][] {
        return Array.isArray(stored);
    }
});

addEventListener("complete", async () => {
    const entries: [string, unknown][] = [];
    const store = getStore();
    for await (const [identifier, item] of store.entries()) {
        if (typeof identifier === "string") {
            entries.push([identifier, item]);
        }
    }
    await cache.set(storeKey, entries);
})

addEventListener("execute", async () => {
    console.log("Execute");

    await import("./tests/app-history.class.js");

    const store = await getStore();

    const eventKey = `${Math.random()}.execute`;

    await store.set(eventKey, {
        createdAt: new Date().toISOString()
    });

});

try {
    await run({

    });
    console.log("Complete");
} catch (error) {
    console.error({ error });
}
