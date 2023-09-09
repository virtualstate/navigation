import {NavigationHistory} from "./history";


export interface ElementPrototype {
    new(): ElementPrototype;
    ownerDocument: unknown;
    parentElement?: ElementPrototype;
    matches(string: string): boolean;
    getAttribute(name: string): string;
    setAttribute(name: string, value: string): void;
    cloneNode(): ElementPrototype;
    click(): void;
    submit(): void;
}

export interface HTMLAnchorElementPrototype extends ElementPrototype {
    download: string;
    href: string;
}

export interface HTMLFormElementPrototype extends ElementPrototype {
    method: string;
    action: string;
}

export interface EventPrototype {
    target: ElementPrototype;
    composedPath?(): ElementPrototype[];
    defaultPrevented: unknown;
    submitter: Record<string, unknown>;
}

export interface MouseEventPrototype extends EventPrototype {
    button: number;
    metaKey: unknown;
    altKey: unknown;
    ctrlKey: unknown;
    shiftKey: unknown;
}

export interface SubmitEventPrototype extends EventPrototype {

}

export interface PopStateEventPrototype extends EventPrototype {
    state: object;
    originalState?: object;
}

export interface WindowLike {
    history?: NavigationHistory<object>
    location?: {
        href?: string
    }
    PopStateEvent?: {
        prototype: {
            state: object
        }
    }
    addEventListener(type: "submit", fn: (event: SubmitEventPrototype) => void): void;
    addEventListener(type: "click", fn: (event: MouseEventPrototype) => void): void;
    addEventListener(type: "popstate", fn: (event: PopStateEventPrototype) => void): void;
    document?: unknown
}

declare var window: WindowLike | undefined;

export const globalWindow = typeof window === "undefined" ? undefined : window;
