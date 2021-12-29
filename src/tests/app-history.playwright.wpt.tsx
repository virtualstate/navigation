/* c8 ignore start */
import * as Playwright from "playwright";
import { h } from "@virtualstate/fringe";
import {deferred} from "../util/deferred";
import fs from "fs";
import path from "path";
import {getConfig} from "./config";
import * as Cheerio from "cheerio";
import {DependenciesHTML} from "./dependencies";
import {Browser, Page} from "playwright";
import {v4} from "uuid";
import v8ToIstanbul from "v8-to-istanbul";

const namespacePath = "/node_modules/wpt/app-history";
const buildPath = "/esnext";
const resourcesInput = "/resources";
const resourcesTarget = "/node_modules/wpt/resources";
const testWrapperFnName = `tests${v4().replace(/[^a-z0-9]/g, "")}`

console.log({ testWrapperFnName });

const DEBUG = false;

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


    const urls = [
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

    console.log("STARTING:");
    urls.forEach(url => console.log(`  - ${url}`));

    let total = 0,
        pass = 0,
        fail = 0,
        // TODO use coverage trace to ensure this scripts lines are fully executed
        linesTotal = 0,
        linesPass = 0,
        linesPassCovered = 0,
        urlsPass = [],
        urlsFailed = [];

    let result = {};

    for (const url of urls) {
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

            console.log(code, code.split('\n').length);


            // console.log(JSON.stringify(coverage));

            console.log(matchingFn.ranges);

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
    }

    await fs.promises.writeFile("./coverage/wpt.results.json", JSON.stringify(result));
    await browser.close();

    console.log("Playwright tests complete");

    console.log("PASSED:");
    urlsPass.forEach(url => console.log(`  - ${url}`));
    console.log("\nFAILED:");
    urlsFailed.forEach(url => console.log(`  - ${url}`));

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

    page.on('console', console.log);
    page.on('pageerror', reject);

    await page.route('**/*', async (route, request) => {
        const { pathname } = new URL(request.url());

        if (pathname.endsWith("foo.html")) {
            return route.abort();
        }

        // console.log({ pathname, isResources: pathname.startsWith(resourcesInput) });
        if (pathname.startsWith(namespacePath) || pathname.startsWith(resourcesInput) || pathname.startsWith(buildPath)) {
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

                const $ = Cheerio.load(contents);

                // Set all scripts as module
                $("script").attr("type", "module");

                const script = $("script:not([src])");

                const scriptText = `
                
                globalThis.rv = [];
                
                const { AppHistory, InvalidStateError, AppHistoryTransitionFinally } = await import("/esnext/index.js");
                
                const appHistory = new AppHistory();
                
                globalThis.appHistory = appHistory;
                
                appHistory.addEventListener("navigateerror", console.error);
                
                // This allows us to wait for the navigation to fully settle before starting 
                const initialNavigationFinally = new Promise((resolve) => appHistory.addEventListener(AppHistoryTransitionFinally, resolve, { once: true }));
                
                // Initialise first navigation to emulate a page loaded
                await appHistory.navigate("/").finished;
                
                await initialNavigationFinally;
                
                add_completion_callback((tests, testStatus) => {
                    console.log("Complete", tests, testStatus)
                    
                    try {
                     if (testStatus.status === testStatus.OK) {
                      globalThis.window.testsComplete();
                    } else {
                      globalThis.window.testsFailed();
                    }
                    } catch (e) {
                       console.log(e);
                    }
                    
                    
                });
                
                const Event = CustomEvent;
                
                const window = {
                  set onload(value) {
                  console.log("onload set");
                    value();
                  },
                  appHistory
                };
                
                const iframe = {
                  contentWindow: {
                    appHistory,
                    DOMException: InvalidStateError
                  }
                };
                
                const i = iframe;
                
                let locationHref = new URL("/", globalThis.window.location.href);
                
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
                
                console.log("Starting tests");
                
                async function ${testWrapperFnName}() {
                  ${script.html() ? script.html().replace("null", "undefined") : "globalThis.window.testsFailed()"}
                }
                
                await ${testWrapperFnName}();
                
                `;

                script.html(scriptText);

                $("*").first().before(DependenciesHTML);

                contents = $.html();
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

    setTimeout(reject, 60000, new Error("Timeout"));

    await promise;


}
/* c8 ignore end */