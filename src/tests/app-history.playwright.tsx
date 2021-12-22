import { chromium } from "playwright";
import { h, toString } from "@virtualstate/fringe";
import {deferred} from "../deferred";
import { DependenciesContent } from "./dependencies";

const browser = await chromium.launch({
    headless: false,
    devtools: true,

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
                    "deno:std@latest": "https://cdn.skypack.dev/@edwardmx/noop"
                }}
            />)
        ),
        h("body", {}, h("script", { type: "module" }, `
        try {
            await import(${JSON.stringify(src)});
            console.log("DONE!!!");
            await window.testsComplete();
        } catch (error) {
            await window.testsFailed(error instanceof Error ? error.message : \`\${error}\`);
        }
        `))
    )
)

const { resolve, reject, promise } = deferred<void>();

declare global {
    interface Window {
        testsComplete?(): void;
        testsFailed?(reason: string): void;
    }
}

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
    const { pathname } = new URL(request.url());
    if (pathname !== "/test-page-entrypoint") return route.continue();
    return route.fulfill({
        body: pageContent
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