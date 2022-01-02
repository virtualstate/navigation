/* c8 ignore start */
import * as Playwright from "playwright";
import { h } from "@virtualstate/fringe";
import {deferred} from "../util/deferred";
import fs from "fs";
import path from "path";
import {getConfig} from "./config";
import * as Cheerio from "cheerio";
import {DependenciesHTML, DependenciesSyncHTML} from "./dependencies";
import {Browser, Page} from "playwright";
import {v4} from "uuid";
import {createJavaScriptBundle} from "./app-history.server.wpt";

const namespacePath = "/node_modules/wpt/app-history";
const namespaceBundlePath = "/app-history";
const buildPath = "/esnext";
const resourcesInput = "/resources";
const resourcesTarget = "/node_modules/wpt/resources";
const testWrapperFnName = `tests${v4().replace(/[^a-z0-9]/g, "")}`

console.log({ testWrapperFnName });

const DEBUG = false;
const AT_A_TIME = 20;

const browsers = [
    ["chromium", Playwright.chromium, { esm: true, args: [], FLAG: "" }] as const,
] as const


// webkit and firefox do not support importmap
for (const [browserName, browserLauncher, { esm, args, FLAG }] of browsers.filter(([, browser]) => browser)) {

    if (FLAG && !getConfig().FLAGS?.includes(FLAG)) {
        continue;
    }

    const browser = await browserLauncher.launch({
        headless: !DEBUG,
        devtools: DEBUG,
        args: [
            ...args
        ]
    });

    console.log(`Running WPT playwright tests for ${browserName} ${browser.version()}`)

    const types = (await fs.promises.readdir(`.${namespacePath}`)).filter(value => !value.includes("."));

    let urls = [
        ...(await Promise.all(
            types.map(async type => {
                return (
                    await fs.promises.readdir(`.${namespacePath}/${type}`)
                )
                    .filter(value => value.endsWith(".html"))
                    .map(value => `/${type}/${value}`)
            })
        ))
            .flatMap(value => value)
    ];

    if (DEBUG) {
        // urls = urls.slice(0, 3);
        urls = urls.filter(url => url.includes("transitionWhile"));
    }

    console.log("STARTING:");
    urls.forEach(url => console.log(`  - ${url}`));

    let total = 0,
        pass = 0,
        fail = 0,
        // TODO use coverage trace to ensure this scripts lines are fully executed
        linesTotal = 0,
        linesPass = 0,
        linesPassCovered = 0,
        urlsPass: string[] = [],
        urlsFailed: string[] = [];

    let result = {};

    while (urls.length) {
        await Promise.all(
            Array.from({ length: AT_A_TIME }, () => urls.shift())
                .filter(Boolean)
                .map(async url => {
                    await withUrl(url);
                    result = {
                        total,
                        pass,
                        fail,
                        percent: Math.round(pass / total * 100 * 100) / 100,
                        linesTotal,
                        linesPass,
                        linesPassCovered,
                        percentLines: Math.round(linesPass / linesTotal * 100 * 100) / 100,
                        percentLinesCovered: Math.round(linesPassCovered / linesTotal * 100 * 100) / 100,
                        percentLinesCoveredMatched: Math.round(linesPassCovered / linesPass * 100 * 100) / 100
                    };
                    console.log(result);
                })
        );
    }

    await fs.promises.writeFile("./coverage/wpt.results.json", JSON.stringify(result));
    await browser.close();

    console.log("Playwright tests complete");

    console.log("PASSED:");
    urlsPass.forEach(url => console.log(`  - ${url}`));
    console.log("\nFAILED:");
    urlsFailed.forEach(url => console.log(`  - ${url}`));

    async function withUrl(url: string) {
        total += 1;
        const context = await browser.newContext({});
        const page = await context.newPage();
        try {
            console.log(`START ${url}`);

            const html = await fs.promises.readFile(`.${namespacePath}/${url}`, 'utf-8');
            const $ = Cheerio.load(html);
            const lines = $("script:not([src])").html()?.split('\n').length ?? 0;
            linesTotal += lines;

            await page.coverage.startJSCoverage();

            await run(browserName, browser, page, url);

            const coverage = await page.coverage.stopJSCoverage();

            const matchingFnEntry = coverage.find(entry => entry.functions.find(fn => fn.functionName === testWrapperFnName));
            const matchingFn = matchingFnEntry.functions.find(fn => fn.functionName === testWrapperFnName);

            const code = matchingFn.ranges
                .filter(range => range.count > 0)
                .map(range => matchingFnEntry.source.slice(range.startOffset, range.endOffset))
                .join('');

            // Minus 2 because this code includes the function definition, start bracket, and end bracket
            const coveredLines = code.split('\n').length - 2;

            // console.log(code.split('\n').length);

            console.log(`PASS  ${url} : ${lines} Lines`);
            urlsPass.push(url);
            pass += 1;
            linesPass += lines;
            linesPassCovered += coveredLines;

        } catch (error) {
            console.log(`FAIL  ${url}`, error);
            fail += 1;
            urlsFailed.push(url);
        }
        await page.close();
        await context.close();
    }
}

console.log(`PASS assertAppHistory:playwright:new AppHistory`);

async function run(browserName: string, browser: Browser, page: Page, url: string) {

    const { resolve, reject, promise } = deferred<void>();

    void promise.catch(error => error);

    await page.exposeFunction("testsComplete", () => {
        console.log(`Playwright tests complete tests for ${browserName} ${browser.version()}`)
        return resolve();
    });
    await page.exposeFunction("testsFailed", (reason: unknown) => {
        console.log(`Playwright tests failed tests for ${browserName} ${browser.version()}`, reason);
        return reject(reason);
    });

    if (DEBUG) {
        page.on('console', console.log);
    } else {
        // you can comment out this one :)
        page.on('console', console.log);
    }

    await page.route('**/*', async (route, request) => {
        const routeUrl = new URL(request.url());
        const { pathname } = routeUrl;

        if (pathname.endsWith("foo.html")) {
            return route.abort();
        }

        // console.log({ pathname, isResources: pathname.startsWith(resourcesInput), isBundle: pathname.startsWith(namespaceBundlePath) && pathname.endsWith(".html.js") });
        if (pathname.startsWith(namespaceBundlePath) && pathname.endsWith(".html.js")) {
            const contents = await createJavaScriptBundle(routeUrl);
            return route.fulfill({
                body: contents,
                headers: {
                    "Content-Type": "application/javascript",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        } else if (pathname.startsWith(namespacePath) || pathname.startsWith(resourcesInput) || pathname.startsWith(buildPath)) {
            const { pathname: file } = new URL(import.meta.url);
            let input = pathname.startsWith(resourcesInput) ? pathname.replace(resourcesInput, resourcesTarget) : pathname;
            let importTarget = path.resolve(path.join(path.dirname(file), '../..', input));
            if (!/\.[a-z]+$/.test(importTarget)) {
                // console.log({ importTarget });
                if (!importTarget.endsWith("/")) {
                    importTarget += "/";
                }
                importTarget += "index.js";
            }
            // console.log({ importTarget });
            let contents = await fs.promises.readFile(importTarget, "utf-8").catch(() => "");

            if (!contents) {
                return route.abort();
            }

            // console.log({ importTarget, contents: !!contents });
            let contentType = "application/javascript";
            if (importTarget.endsWith(".html")) {
                contentType = "text/html";

                const globalNames = [
                    "appHistory",
                    "window",
                    "i",
                    "iframe",
                    "location",
                    "history",
                    "promise_test",
                    "test",
                    "assert_true",
                    "assert_equals",
                    "async_test",
                ]

                const targetUrl = `${namespaceBundlePath}${url}.js?exportAs=${testWrapperFnName}&globals=${globalNames.join(",")}`;

                // console.log({ targetUrl, namespacePath, url })
                const scriptText = `
globalThis.rv = [];

const { ${testWrapperFnName} } = await import("${targetUrl}&preferUndefined=1&localDependenciesOnly=1");

const { AppHistory, InvalidStateError, AppHistoryTransitionFinally } = await import("/esnext/index.js");

let appHistoryTarget = new AppHistory();

function proxyAppHistory(appHistory, get) {
  return new Proxy(appHistory, {
    get(u, property) {
      const currentTarget = get();
      const value = currentTarget[property];
      if (typeof value === "function") return value.bind(currentTarget);
      return value;
    }
  });
}

const appHistory = proxyAppHistory(appHistoryTarget, () => appHistoryTarget);

globalThis.appHistory = appHistory;

appHistory.addEventListener("navigateerror", console.error);

async function navigateFinally(appHistory, url) {
    // This allows us to wait for the navigation to fully settle before starting 
    const initialNavigationFinally = new Promise((resolve) => appHistory.addEventListener(AppHistoryTransitionFinally, resolve, { once: true }));
    
    // Initialise first navigation to emulate a page loaded
    await appHistory.navigate(url).finished;
    
    await initialNavigationFinally;
}
await navigateFinally(appHistoryTarget, "/");

const Event = CustomEvent;

const window = {
  set onload(value) {
    value();
  },
  appHistory
};

let iframeAppHistoryTarget = new AppHistory();
await navigateFinally(iframeAppHistoryTarget, "/");
const iframe = {
  contentWindow: {
    appHistory: proxyAppHistory(iframeAppHistoryTarget, () => iframeAppHistoryTarget),
    DOMException: InvalidStateError
  },
  remove() {
    iframeAppHistoryTarget = new AppHistory();
  }
};
const i = iframe;

let locationHref = new URL("/", globalThis.window.location.href);

const history = {
  pushState(state, title, url) {
    if (url) {
      appHistory.navigate(url, { state });
    } else {
      appHistory.updateCurrent({ state });
    }
  },
  back() {
    return appHistory.back();
  }
}

const location = {
    get href() {
        return locationHref.toString()
    },
    set href(value) {
        locationHref = new URL(value, locationHref.toString());
        const { finished, committed } = appHistory.navigate(locationHref.toString());
        void committed.catch(error => error);
        void finished.catch(error => error);
    },
    get hash() {
        return locationHref.hash;
    }
}

const testSteps = [];

// Wait for all navigations to settle
appHistory.addEventListener("navigate", () => {
  const finished = appHistory.transition.finished;
  testSteps.push(() => finished.catch(error => error));
})
iframe.contentWindow.appHistory.addEventListener("navigate", () => {
  const finished = appHistory.transition.finished;
  testSteps.push(() => finished.catch(error => error));
})

let tests = 0;

function promise_test(fn) {
  testSteps.push(fn);
  tests += 1;
}
function async_test(fn) {
  testSteps.push(fn);
  tests += 1;
}
function test(fn) {
  testSteps.push(fn);
  tests += 1;
}
function assert_true(value, message = "Expected true") {
  // console.log(value);
  if (value !== true) {
    throw new Error(message);
  }
}
function assert_equals(left, right) {
  // console.log(JSON.stringify({ left, right }));
  assert_true(left === right, "Expected values to equal");
}

const t = {
  step_timeout(resolve, timeout) {
    setTimeout(resolve, timeout);  
  },
  step_func(fn) {
    let resolve, reject;
    const promise = new Promise((resolveFn, rejectFn) => { resolve = resolveFn; reject = rejectFn; });
    testSteps.push(() => promise);
    return (...args) => {
      try {
        const result = fn(...args);
        if (result && "then" in result) {
           return result.then(resolve, reject).then(() => result);
        } else {
           resolve();
        }
        return result;
      } catch (error) {
        reject(error);
        throw error;
      }
    }
  },
}

console.log("Starting tests");

await ${testWrapperFnName}({
  ${globalNames.join(",\n")}
});

if (!testSteps.length) {
  console.error("No tests configured");
  globalThis.window.testsFailed("No tests configured");
} else {
  try {
    await Promise.all(testSteps.map(async test => test(t)));
    globalThis.window.testsComplete(tests);
  } catch (error) {
    globalThis.window.testsFailed(error);
    throw error;
  }
}
                
                `.trim();
                contents = `
${DependenciesSyncHTML}
<script type="module">${scriptText}</script>
                `.trim()
                //
                // console.log(contents);
            }


            return route.fulfill({
                body: contents,
                headers: {
                    "Content-Type": contentType,
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        return route.continue();
    })

    await page.goto(`https://example.com${namespacePath}${url}`, {

    });

    // console.log("Navigation started");

    await page.waitForLoadState("load");

    // console.log("Loaded document");

    await page.waitForLoadState("networkidle");

    // console.log("Network idle");

    setTimeout(reject, 30000, new Error("Timeout"));

    try {
        await promise;
    } catch (e) {
        if (DEBUG) {
            // await new Promise(() => void 0);
            // await new Promise(resolve => setTimeout(resolve, 5000));
        }
    } finally {
        if (DEBUG) {
            // await new Promise(() => void 0);
            // await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}
/* c8 ignore end */