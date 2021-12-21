import { chromium } from "playwright";
import { h, toString } from "@virtualstate/fringe";

const browser = await chromium.launch();
const context = await browser.newContext({});
const page = await context.newPage();

const pageContent = await toString(
    h("html", {},
        h("head", {}, h("title", {}, "Website")),
        h("body", {}, h("script", { type: "module" }, "\n"))
    )
)

await page.goto(`data:text/html;${encodeURIComponent(pageContent)}`);