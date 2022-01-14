import {AppHistory} from "../../app-history";
import {URLPattern} from "urlpattern-polyfill";
import {EventTarget} from "../../event-target";
import {assert, ok} from "../util";

export async function urlPatternExample(appHistory: AppHistory) {

    const unexpectedPage = `${Math.random()}`;
    const body: EventTarget & { innerHTML?: string } = new EventTarget();
    body.innerHTML = "";

    appHistory.addEventListener("navigate", ({ destination, transitionWhile }) => {
        return transitionWhile(handler())

        async function handler() {
            const identifiedTest = new URLPattern({
                pathname: "/test/:id"
            });
            if (identifiedTest.test(destination.url)) {
                body.innerHTML = destination.getState<{ innerHTML: string }>().innerHTML;
            } else {
                throw new Error(unexpectedPage);
            }
        }
    });

    const expectedHTML = `${Math.random()}`;

    await appHistory.navigate("/test/1", {
        state: {
            innerHTML: expectedHTML
        }
    }).finished;

    ok(body.innerHTML === expectedHTML);

    const error = await appHistory.navigate('/photos/1').finished.catch(error => error);

    assert<Error>(error);
    ok(error.message === unexpectedPage);

    await appHistory.navigate("/test/2", {
        state: {
            innerHTML: `${expectedHTML}.2`
        }
    }).finished;

    ok(body.innerHTML === `${expectedHTML}.2`);

    console.log({ body }, appHistory);
}

export async function urlPatternLoadBooksExample(appHistory: AppHistory) {
    const booksPattern = new URLPattern({ pathname: "/books/:id" });
    let bookId;
    appHistory.addEventListener("navigate", async ({destination, transitionWhile}) => {
        const match = booksPattern.exec(destination.url);
        if (match) {
            transitionWhile(transition());
        }

        async function transition() {
            console.log("load book", match.pathname.groups.id)
            bookId = match.pathname.groups.id;
        }
    });
    const id = `${Math.random()}`;
    await appHistory.navigate(`/books/${id}`).finished;
    assert(id === bookId);
}