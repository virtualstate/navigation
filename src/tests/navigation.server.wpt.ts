import { createServer } from "http";
import { resolve, dirname, join } from "path";
import * as Cheerio from "cheerio";
import { promises as fs } from "fs";

const namespacePath = "/node_modules/wpt";
const buildPath = "/esnext";
const resourcesInput = "/resources";
const resourcesTarget = "/node_modules/wpt/resources";

export function startServer(port: number) {
  const server = createServer((request, response) => {
    const url = new URL(request.url, `http://localhost:${port}`);
    let promise = Promise.resolve("");

    response.setHeader("Access-Control-Allow-Origin", "*");

    console.log({ pathname: url.pathname });

    if (url.pathname.endsWith(".html.js")) {
      promise = createJavaScriptBundle(url);
      response.setHeader("Content-Type", "application/javascript");
    }
    promise
      .then((contents) => {
        response.writeHead(200);
        response.write(contents);
      })
      .catch((error) => {
        console.log({ error });
        response.writeHead(500);
      })
      .then(() => response.end());
  });

  server.listen(port, () => {
    console.log(
      `Running Web Platform Tests ECMAScript Modules server on port ${port}`
    );
  });

  return () => {};
}

export async function createJavaScriptBundle(url: URL) {
  const cwd = resolve(dirname(new URL(import.meta.url).pathname), "../..");
  const withoutExtension = url.pathname.replace(/\.html\.js$/, "");
  console.log({ cwd, withoutExtension });
  if (withoutExtension.includes("..")) throw new Error("Unexpected double dot in path");
  const htmlPath = join(cwd, namespacePath, `${withoutExtension}.html`);
  console.log({ cwd, withoutExtension, htmlPath });
  const html = await fs.readFile(htmlPath, "utf-8");
  if (!html) return "";
  const $ = Cheerio.load(html);

  const dependencies = await Promise.all(
    $("script[src]")
      .map(function () {
        return $(this).attr("src");
      })
      .toArray()
      .filter((dependency) =>
        url.searchParams.get("localDependenciesOnly")
          ? !dependency.startsWith("/")
          : true
      )
      .map(
        async (dependency): Promise<[string, string]> => [
          dependency,
          await fs
            .readFile(
              join(
                cwd,
                namespacePath,
                new URL(dependency, url.toString()).pathname
              ),
              "utf-8"
            )
            .catch(() => "// Could not load"),
        ]
      )
  );

  const dependenciesJoined = `

// 
const self = globalThis;

${dependencies
  .map(([name, contents]) => `// ${name.replace(cwd, "")}\n${contents}`)
  .join("\n")}
    `;

  const scripts = $("script:not([src])")
    .map(function () {
      return $(this).html() ?? "";
    })
    .toArray();

  let scriptsJoined = scripts.join("\n");

  if (url.searchParams.get("preferUndefined")) {
    // eek
    scriptsJoined = scriptsJoined.replace(/null/g, "undefined");
  }

  let fnName = url.searchParams.get("exportAs");

  // https://stackoverflow.com/a/2008353/1174869
  const identifierTest = /^[$A-Z_][0-9A-Z_$]*$/i;

  if (!fnName || !identifierTest.test(fnName)) {
    fnName = "runTests";
  }

  let globalNames = (url.searchParams.get("globals") ?? "")
    .split(",")
    .filter((name) => identifierTest.test(name));

  if (!globalNames.length) {
    globalNames = ["______globals_object_key"];
  }

  const globalsDestructure = `{${globalNames.join(", ")}}`;

  const scriptHarness = `
export function ${fnName}(${globalsDestructure}) {${
    url.searchParams.get("debugger")
      ? "\nconsole.log('debugger start');debugger;\n"
      : ""
  }
    ${scriptsJoined}
}
    `.trim();

  if (url.searchParams.get("dependenciesOnly")) {
    return dependenciesJoined;
  }
  if (url.searchParams.get("scriptsOnly")) {
    return scriptHarness;
  }

  return `${dependenciesJoined}\n${scriptHarness}`;
}

if (
  typeof process !== "undefined" &&
  process.argv.includes(new URL(import.meta.url).pathname)
) {
  const portString = process.env.PORT || "";
  const port = /^\d+$/.test(portString) ? +portString : 3000;
  void startServer(port);
}
