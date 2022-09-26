import type {
    NavigateEvent as Spec,
    NavigateEventInit,
    NavigationDestination,
    NavigationIntercept,
    NavigationNavigationType
} from "../spec/navigation";

export class NavigateEvent<S = unknown> implements Spec<S> {
    [key: number]: unknown;
    [key: string]: unknown;

    readonly canIntercept: boolean;
    /**
     * @deprecated
     */
    readonly canTransition: boolean;
    readonly destination: NavigationDestination<S>;
    readonly downloadRequest?: string;
    readonly formData?: FormData;
    readonly hashChange: boolean;
    readonly info: unknown;
    readonly signal: AbortSignal;
    readonly userInitiated: boolean;
    readonly navigationType: NavigationNavigationType;

    constructor(public type: "navigate", init: NavigateEventInit<S>) {
        if (!init) {
            throw new TypeError("init required");
        }
        if (!init.destination) {
            throw new TypeError("destination required");
        }
        if (!init.signal) {
            throw new TypeError("signal required");
        }
        this.canIntercept = init.canIntercept ?? false;
        this.canTransition = init.canIntercept ?? false;
        this.destination = init.destination;
        this.downloadRequest = init.downloadRequest;
        this.formData = init.formData;
        this.hashChange = init.hashChange ?? false;
        this.info = init.info;
        this.signal = init.signal;
        this.userInitiated = init.userInitiated ?? false;
        this.navigationType = init.navigationType ?? "push";
    }


    commit(): void {
        throw new Error("Not implemented");
    }

    intercept(options?: NavigationIntercept<unknown | void>): void {
        throw new Error("Not implemented");
    }

    preventDefault(): void {
        throw new Error("Not implemented");
    }

    reportError(reason: unknown): void {
        throw new Error("Not implemented");
    }

    scroll(): void {
        throw new Error("Not implemented");
    }

    /**
     * @deprecated
     */
    transitionWhile(options?: NavigationIntercept<unknown | void>): void {
        return this.intercept(options);
    }

}