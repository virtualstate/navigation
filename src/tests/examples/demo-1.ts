import * as Cheerio from "cheerio";
import { Navigation } from "../../spec/navigation";
import { fetch } from "./fetch";
import { addEventListener } from "../../event-target/global";
import { Response } from "@opennetwork/http-representation";
import { ok } from "../util";
import { v4 } from "../../util/uuid-or-random";
import { parseDOM } from "../../util/parse-dom";

const SUBPAGE_MARKER = v4();

export async function demo1(navigation: Navigation) {
  addSubpageEventListener();

  let delayChecked = false;

  interface Element {
    localName: string;
    replaceWith(element: Element): void;
    innerHTML: string;
    textContent: string;
    style: Record<string, unknown>;
    checked?: boolean;
  }

  const elements: Record<string, Element> = {
    "#add-delay": {
      ...createElement("button"),
      get checked() {
        return delayChecked;
      },
    },
    main: {
      ...createElement("main"),
      replaceWith(element: Element) {
        elements["main"] = {
          ...element,
          replaceWith: this.replaceWith,
        };
      },
    },
  };

  const document = {
    querySelector(query: string) {
      return elements[query];
    },
    body: {
      children: [createElement("p")],
    },
    createElement,
    documentTransition: {
      start() {},
    },
    title: "",
  };

  function createElement(localName: string): Element {
    return {
      localName,
      textContent: "",
      innerHTML: "",
      style: {
        contain: "",
      },
      replaceWith(element: Element) {},
    };
  }

  // const useSET = document.querySelector("#use-set");
  // if (!document.documentTransition) {
  //   useSET.checked = false;
  // }
  const addDelay = document.querySelector("#add-delay");

  const sharedElements = [...document.body.children].filter(
    (el) => el.localName !== "main"
  );
  for (const el of sharedElements) {
    el.style.contain = "paint";
  }

  navigation.addEventListener("navigateerror", console.error);

  navigation.addEventListener("navigate", (e) => {
    console.log(e);

    if (!e.canIntercept || e.hashChange) {
      return;
    }

    e.intercept({
      async handler() {
        e.signal.addEventListener("abort", () => {
          // console.log(e.signal);
          const newMain = document.createElement("main");
          newMain.textContent = "You pressed the browser stop button!";
          document.querySelector("main").replaceWith(newMain);
          console.log("Hello?");
        });

        if (addDelay.checked) {
          await delay(2_000, { signal: e.signal });
        }

        // if (useSET.checked) {
        //   await document.documentTransition.prepare({
        //     rootTransition: getTransition(e),
        //     sharedElements
        //   });
        //   document.documentTransition.start({ sharedElements });
        // }

        const body = await (
            await fetch(e.destination.url, { signal: e.signal })
        ).text();
        const { title, main } = await getResult(body);

        document.title = title;
        document.querySelector("main").replaceWith(main);

        // if (useSET.checked) {
        //     await document.documentTransition.start();
        // }
      }
    });
  });

  async function getResult(htmlString: string) {
    const { innerHTML, title } = await parseDOM(htmlString, "main");
    const main = createElement("main");
    main.innerHTML = innerHTML;
    return { title, main };
  }

  // function getTransition(e) {
  //     if (e.navigationType === "reload" || e.navigationType === "replace") {
  //         return "explode";
  //     }
  //     if (e.navigationType === "traverse" && e.destination.index < navigation.current.index) {
  //         return "reveal-right";
  //     }
  //     return "reveal-left";
  // }

  function delay(ms: number, event?: { signal?: AbortSignal }) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, ms);
      event?.signal?.addEventListener("abort", reject);
    });
  }

  await navigation.navigate("subpage.html").finished;

  const main = document.querySelector("main");

  ok(main);
  ok(main.innerHTML);

  // console.log(main.innerHTML);
  ok(main.innerHTML.includes(SUBPAGE_MARKER));
}

function addSubpageEventListener() {
  addEventListener("fetch", (event) => {
    const { pathname } = new URL(event.request.url);
    if (pathname !== "/subpage.html") return;
    return event.respondWith(
      new Response(
        `
<!DOCTYPE html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>App history demo: subpage</title>
<link rel="stylesheet" href="style.css">

<h1><a href="https://github.com/WICG/navigation/">App history</a> demo</h1>

<main>
  <p>I am <code>subpage.html</code>!</p>
  
  <p>You can use either your browser back button, or the following link, to go back to index.html. Either will perform a single-page navigation, in browsers that support app history!</p>

  <p><a href="/">Back to index.html</a>.</p>
  
  <p><button onclick="history.back()">history.back()</button></p>
  <p>Page id: ${SUBPAGE_MARKER}</p>
</main>

<p>If you see this, you did a normal multi-page navigation, not an app history-mediated single-page navigation.</p>
  
<footer><a href="https://glitch.com/edit/#!/gigantic-honored-octagon?path=index.html">View source and edit on Glitch</a></footer>

`,
        {
          status: 200,
          headers: {
            "Content-Type": "text/html",
          },
        }
      )
    );
  });
}
