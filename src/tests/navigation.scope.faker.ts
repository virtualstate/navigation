/* c8 ignore start */
import {NavigateEvent, Navigation} from "../spec/navigation";
import {like, ok} from "../is";
import {EventCallback, EventTarget} from "../event-target";
import {Navigation as NavigationPolyfill, NavigationSetCurrentKey, NavigationSetEntries} from "../navigation";
import {assertNavigationWithWindow} from "./navigation.scope";
import {v4} from "../util/uuid-or-random";
import {applyPolyfill} from "../apply-polyfill";
import {NavigationHistory} from "../history";


export default 1;

const window: EventTarget & { document?: unknown } = new EventTarget();
const document: EventTarget & { createElement?: unknown } = new EventTarget();

interface ElementLike {
    matches(query: string): boolean;
    submit?(): void;
    click?(): void;
}

function createElement(type: string) {
    const target: EventTarget & Record<string, unknown> & Partial<ElementLike> = new EventTarget();
    const children = new Set();
    target.ownerDocument = document;
    target.click = () => {
        console.log("Click", type);
        if (type === "a") {
            console.log("dispatchEvent click")
            window.dispatchEvent({
                type: "click",
                target,
                button: 0
            });
        } else if (type === "button") {
            if (target.type === "submit" && like<ElementLike>(target.parentElement)) {
                if (target.parentElement.matches("form")) {
                    return target.parentElement.submit();
                }
            }
        }
    }
    target.submit = () => {
        window.dispatchEvent({
            type: "submit",
            target
        });
    }
    target.matches = (query: string) => {
        if (query.startsWith("a[href]")) {
            return type === "a" && !!target.href
        }
        return query.startsWith(type);
    }
    target.appendChild = (child: { parentElement: unknown }) => {
        children.add(child)
        child.parentElement = target;
    }
    target.removeChild = (child: { parentElement: unknown }) => {
        children.delete(child)
        child.parentElement = undefined;
    }
    return target
}

document.createElement = createElement;
document.body = createElement("body")

window.document = document

const navigation = new NavigationPolyfill({
    entries: [
        {
            key: v4()
        }
    ]
});

applyPolyfill({
    window,
    history: new NavigationHistory({
        navigation
    })
});

console.log("applyPolyfill", navigation)

ok<Window>(window);
ok<Document>(document);

declare var FormData: unknown;

if (typeof FormData !== "undefined") {
    console.log("FormData exists, will test navigation as a polyfill");
    await assertNavigationWithWindow(
        window,
        navigation
    )
} else {
    console.log("FormData does not exists, will not test navigation as a polyfill");
}