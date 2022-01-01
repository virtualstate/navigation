import * as Playwright from "playwright";
import { h, toString } from "@virtualstate/fringe";
import {deferred} from "../util/deferred";
import { DependenciesContent } from "./dependencies";
import fs from "fs";
import path from "path";
import {getConfig} from "./config";

declare global {
    interface Window {
        testsComplete?(): void;
        testsFailed?(reason: string): void;
    }
}

const DEBUG = false;

const browsers = [
    ["chromium", Playwright.chromium, { eventTarget: "async", esm: true, args: ["--enable-experimental-web-platform-features"], FLAG: "SPEC_BROWSER" }] as const,
    ["chromium", Playwright.chromium, { eventTarget: "async", esm: true, args: [], FLAG: "" }] as const,
    ["webkit", Playwright.webkit, { eventTarget: "async", esm: false, args: [], FLAG: "" }] as const,
    ["firefox", Playwright.firefox, { eventTarget: "async", esm: false, args: [], FLAG: "" }] as const,
    ["chromium", Playwright.chromium, { eventTarget: "sync", esm: true, args: ["--enable-experimental-web-platform-features"], FLAG: "SPEC_BROWSER" }] as const,
    ["chromium", Playwright.chromium, { eventTarget: "sync", esm: true, args: [], FLAG: "" }] as const,
    ["webkit", Playwright.webkit, { eventTarget: "sync", esm: false, args: [], FLAG: "" }] as const,
    ["firefox", Playwright.firefox, { eventTarget: "sync", esm: false, args: [], FLAG: "" }] as const
] as const

// webkit and firefox do not support importmap
for (const [browserName, browserLauncher, { eventTarget, esm, args, FLAG }] of browsers.filter(([, browser]) => browser)) {

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
    console.log(`Running playwright tests for ${browserName} ${browser.version()}`)
    const context = await browser.newContext({});
    const page = await context.newPage();

    const namespacePath = "/@virtualstate/app-history/";
    const testsSrcPath = `${namespacePath}tests/${esm ? "" : "rollup.js"}`;

    const eventTargetSyncPath = `${namespacePath}event-target/sync`
    const eventTargetAsyncPath = `${namespacePath}event-target/async`

    let src = `https://cdn.skypack.dev${testsSrcPath}`;

    const pageContent = await toString(
        h("html", {},
            h("head", {},
                h("title", {}, "Website"),
                h("script", { type: "importmap" }, <DependenciesContent
                    imports={{
                        "deno:std@latest": "https://cdn.skypack.dev/@edwardmx/noop",
                        "@virtualstate/nop": "https://cdn.skypack.dev/@edwardmx/noop",
                        "@virtualstate/app-history/event-target": `https://cdn.skypack.dev/@virtualstate/app-history/event-target/${eventTarget}`,
                    }}
                />)
            ),
            h("body", {}, h("script", { type: "module" }, `
            
        if (typeof appHistory !== "undefined") {
          console.log("Global AppHistory exists");
        } else {
          console.log("Global AppHistory does not exist");
        }
            
        console.log("Waiting for window to load");
        await new Promise(resolve => window.addEventListener("load", resolve));
        console.log("Load event fired");
        
        // while (!window.testsComplete) {
        //   console.log("testsComplete not available, waiting for definition");
        //   // await new Promise(resolve => setTimeout(resolve, 1000));
        // }
        // console.log(!!window.testsComplete, !!window.testsFailed);
        
        try {
            await import(${JSON.stringify(src)});
            await window.testsComplete();
        } catch (error) {
            console.log(error instanceof Error ? error.message : \`\${error}\`);
            console.log(error);
            console.log(error.stack);
            await window.testsFailed(error instanceof Error ? error.message : \`\${error}\`);
        }
        `))
        )
    )

    const { resolve, reject, promise } = deferred<void>();

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
        const { pathname, hostname } = new URL(request.url());
        // console.log(await request.headersArray());

        if (pathname.startsWith(namespacePath)) {
            const { pathname: file } = new URL(import.meta.url);
            let importTarget = path.resolve(path.join(path.dirname(file), "..", pathname.replace(namespacePath, "")));
            // console.log({ pathname, eventTargetSyncPath, eventTargetAsyncPath })
            if (pathname === eventTargetSyncPath) {
                importTarget = path.resolve(path.join(importTarget, "../sync-event-target.js"))
            } else if (pathname === eventTargetAsyncPath) {
                importTarget = path.resolve(path.join(importTarget, "../async-event-target.js"))
            } else if (!/\.[a-z]+$/.test(importTarget)) {
                // console.log({ importTarget });
                if (!importTarget.endsWith("/")) {
                    importTarget += "/";
                }
                importTarget += "index.js";
            }
            // console.log({ importTarget });
            const contents = await fs.promises.readFile(importTarget, "utf-8");
            // console.log({ importTarget, contents: !!contents });
            return route.fulfill({
                body: contents,
                headers: {
                    "Content-Type": "application/javascript",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        // console.log({ pathname, hostname });
        // if (pathname !== "/test-page-entrypoint") return route.continue();
        if (hostname !== "example.com") return route.continue();
        if (pathname.includes(".ico")) return route.fulfill({
            status: 200
        })
        return route.fulfill({
            body: pageContent,
            headers: {
                "Content-Type": "text/html"
            }
        })
    })

    await page.goto("https://example.com/test-page-entrypoint", {

    });

    console.log("Navigation started");

    await page.waitForLoadState("load");

    console.log("Loaded document");

    await page.waitForLoadState("networkidle");

    console.log("Network idle");

    await promise;

    console.log("Playwright tests complete");

    await page.close();
    await browser.close();
}

console.log(`PASS assertAppHistory:playwright:new AppHistory`);