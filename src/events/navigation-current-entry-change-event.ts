import type {
    NavigationCurrentEntryChangeEvent as Spec,
    NavigationCurrentEntryChangeEventInit,
    NavigationHistoryEntry,
    NavigationNavigationType
} from "../spec/navigation";

export class NavigationCurrentEntryChangeEvent<S = unknown> implements Spec<S> {
    [key: number]: unknown;
    [key: string]: unknown;

    readonly from: NavigationHistoryEntry<S>;
    readonly navigationType?: NavigationNavigationType;

    constructor(public type: "currententrychange", init: NavigationCurrentEntryChangeEventInit<S>) {
        if (!init) {
            throw new TypeError("init required");
        }
        if (!init.from) {
            throw new TypeError("from required");
        }
        this.from = init.from;
        this.navigationType = init.navigationType ?? undefined;
    }
}