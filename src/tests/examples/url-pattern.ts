import { Navigation } from "../../navigation";
import { URLPattern } from "urlpattern-polyfill";
import { EventTarget } from "../../event-target";
import { assert, ok } from "../util";

export async function urlPatternExample(navigation: Navigation) {
  const unexpectedPage = `${Math.random()}`;
  const body: EventTarget & { innerHTML?: string } = new EventTarget();
  body.innerHTML = "";

  navigation.addEventListener(
    "navigate",
    ({ destination, transitionWhile }) => {
      return transitionWhile(handler());

      async function handler() {
        const identifiedTest = new URLPattern({
          pathname: "/test/:id",
        });
        if (identifiedTest.test(destination.url)) {
          body.innerHTML = destination.getState<{
            innerHTML: string;
          }>().innerHTML;
        } else {
          throw new Error(unexpectedPage);
        }
      }
    }
  );

  const expectedHTML = `${Math.random()}`;

  await navigation.navigate("/test/1", {
    state: {
      innerHTML: expectedHTML,
    },
  }).finished;

  ok(body.innerHTML === expectedHTML);

  const error = await navigation
    .navigate("/photos/1")
    .finished.catch((error) => error);

  assert<Error>(error);
  ok(error.message === unexpectedPage);

  await navigation.navigate("/test/2", {
    state: {
      innerHTML: `${expectedHTML}.2`,
    },
  }).finished;

  ok(body.innerHTML === `${expectedHTML}.2`);

  console.log({ body }, navigation);
}

export async function urlPatternLoadBooksExample(navigation: Navigation) {
  const booksPattern = new URLPattern({ pathname: "/books/:id" });
  let bookId;
  navigation.addEventListener(
    "navigate",
    async ({ destination, transitionWhile }) => {
      const match = booksPattern.exec(destination.url);
      if (match) {
        transitionWhile(transition());
      }

      async function transition() {
        console.log("load book", match.pathname.groups.id);
        bookId = match.pathname.groups.id;
      }
    }
  );
  const id = `${Math.random()}`;
  await navigation.navigate(`/books/${id}`).finished;
  assert(id === bookId);
}
