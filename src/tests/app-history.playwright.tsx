import { chromium } from "playwright";
import { h, toString } from "@virtualstate/fringe";
import {deferred} from "../deferred";
import { DependenciesContent } from "./dependencies";
import { promises as fs } from "fs";
import { join, dirname, resolve as pathResolve } from "path";

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
        args: [
            "--enable-experimental-web-platform-features"
        ]
    });
    const context = await browser.newContext({});
    const page = await context.newPage();

    const namespacePath = "/@virtualstate/app-history/";
    const testsSrcPath = `${namespacePath}tests/`;

    let src = `https://cdn.skypack.dev${testsSrcPath}`;

    const pageContent = await toString(
        h("html", {},
            h("head", {},
                h("title", {}, "Website"),
                h("script", { type: "importmap" }, <DependenciesContent
                    imports={{
                        "deno:std@latest": "https://cdn.skypack.dev/@edwardmx/noop",
                        "@virtualstate/nop": "https://cdn.skypack.dev/@edwardmx/noop",
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
    page.on('pageerror', reject);

    await page.route('**/*', async (route, request) => {
        const { pathname, hostname } = new URL(request.url());
        // console.log(await request.headersArray());

        if (pathname.startsWith(namespacePath)) {
            const { pathname: file } = new URL(import.meta.url);
            let importTarget = pathResolve(join(dirname(file), '..', pathname.replace(namespacePath, "")));
            if (!/\.[a-z]+$/.test(importTarget)) {
                // console.log({ importTarget });
                if (!importTarget.endsWith("/")) {
                    importTarget += "/";
                }
                importTarget += "index.js";
            }
            // console.log({ importTarget });
            const contents = await fs.readFile(importTarget, "utf-8");
            // console.log({ importTarget, contents: !!contents });
            return route.fulfill({
                body: contents,
                headers: {
                    'Content-Type': 'application/javascript',
                    'Access-Control-Allow-Origin': '*'
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