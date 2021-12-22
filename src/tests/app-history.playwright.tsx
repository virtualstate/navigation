import { chromium } from "playwright";
import { h, toString } from "@virtualstate/fringe";
import {deferred} from "../deferred";
import { DependenciesContent } from "./dependencies";

const browser = await chromium.launch({
    headless: false,
    devtools: true
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
        h("body", {}, h("script", { type: "module", src }, "\n"))
    )
)

const { resolve, reject, promise } = deferred<void>();

declare global {
    interface Window {
        testsComplete?(): void;
        testsFailed?(reason: string): void;
    }
}

await page.exposeFunction("testsComplete", resolve);
await page.exposeFunction("testsFailed", reject);

page.on('console', console.log);

await page.goto(`data:text/html,${encodeURIComponent(pageContent)}`, {

});

console.log("Navigation started");

await page.waitForLoadState("load");

console.log("Loaded document");

await page.waitForLoadState("networkidle");

console.log("Network idle");

await promise;