import { chromium } from "playwright";
import { h, toString } from "@virtualstate/fringe";
import {deferred} from "../deferred";
import { DependenciesContent } from "./dependencies";

declare global {
    interface Window {
        testsComplete?(): void;
        testsFailed?(reason: string): void;
    }
}

const DEBUG = false;

// webkit and firefox do not support importmap
for (const browserLauncher of [chromium/*, webkit, firefox*/]) {
    const browser = await browserLauncher.launch({
        headless: !DEBUG,
        devtools: DEBUG,

    });
    const context = await browser.newContext({});
    const page = await context.newPage();

    let src = "https://cdn.skypack.dev/@virtualstate/app-history/tests";

    const pageContent = await toString(
        h("html", {},
            h("head", {},
                h("title", {}, "Website"),
                h("script", { type: "importmap" }, <DependenciesContent
                    imports={{
                        "deno:std@latest": "https://cdn.skypack.dev/@edwardmx/noop",
                        "@virtualstate/nop": "https://cdn.skypack.dev/@edwardmx/noop"
                    }}
                />)
            ),
            h("body", {}, h("script", { type: "module" }, `
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
            await window.testsFailed(error instanceof Error ? error.message : \`\${error}\`);
        }
        `))
        )
    )

    const { resolve, reject, promise } = deferred<void>();

    await page.exposeFunction("testsComplete", () => {
        console.log("Tests complete");
        return resolve();
    });
    await page.exposeFunction("testsFailed", (reason: unknown) => {
        console.log("Tests failed");
        return reject(reason);
    });

    page.on('console', console.log);

    await page.route('**/*', (route, request) => {
        const { pathname, hostname } = new URL(request.url());
        console.log({ pathname, hostname });
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