import "./correct-import-extensions.js";
import { promises as fs } from "fs";
import { rollup } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import ignore from "rollup-plugin-ignore";
import { dirname, resolve } from "path";

const { pathname } = new URL(import.meta.url);
const cwd = resolve(dirname(pathname), "..")

{

  const bundle = await rollup({
    input: "./esnext/tests/index.js",
    plugins: [
      ignore([
        "playwright",
        "fs",
        "path",
        "cheerio",
        "@virtualstate/navigation",
        "@virtualstate/navigation-imported",
        `${cwd}/esnext/tests/navigation.playwright.js`,
        `${cwd}/esnext/tests/navigation.playwright.wpt.js`,
        `${cwd}/esnext/tests/dependencies-input.js`,
        `${cwd}/esnext/tests/dependencies.js`,
        "./navigation.playwright.js",
        "./navigation.playwright.wpt.js",
      ]),
      nodeResolve()
    ],
    inlineDynamicImports: true,
    treeshake: {
      preset: "smallest",
      moduleSideEffects: "no-external"
    }
  });
  await bundle.write({
    sourcemap: true,
    output: {
      file: "./esnext/tests/rollup.js",
    },
    inlineDynamicImports: true,
    format: "cjs",
    interop: "auto",
    globals: {
      "esnext/tests/navigation.playwright.js": "globalThis"
    }
  });
}

{

  const bundle = await rollup({
    input: "./esnext/index.js",
    plugins: [
      ignore([
        `${cwd}/esnext/tests/navigation.playwright.js`,
        `${cwd}/esnext/tests/navigation.playwright.wpt.js`,
        `${cwd}/esnext/tests/dependencies-input.js`,
        `${cwd}/esnext/tests/dependencies.js`,
      ]),
      nodeResolve()
    ],
    inlineDynamicImports: true,
    treeshake: {
      preset: "smallest",
      moduleSideEffects: "no-external"
    }
  });
  await bundle.write({
    sourcemap: true,
    file: "./esnext/rollup.js",
    inlineDynamicImports: true,
    format: "esm",
    interop: "auto",
    globals: {

    }
  });
}
{

  const bundle = await rollup({
    input: "./esnext/routes/index.js",
    plugins: [
      ignore([
        `${cwd}/esnext/tests/navigation.playwright.js`,
        `${cwd}/esnext/tests/navigation.playwright.wpt.js`,
        `${cwd}/esnext/tests/dependencies-input.js`,
        `${cwd}/esnext/tests/dependencies.js`,
      ]),
      nodeResolve()
    ],
    inlineDynamicImports: true,
    treeshake: {
      preset: "smallest",
      moduleSideEffects: "no-external"
    }
  });
  await bundle.write({
    sourcemap: true,
    output: {
      file: "./esnext/routes-rollup.js",
    },
    inlineDynamicImports: true,
    format: "esm",
    interop: "auto",
    globals: {

    }
  });
}


{

  const bundle = await rollup({
    input: "./esnext/polyfill.js",
    plugins: [
      ignore([
        "@virtualstate/app-history",
        `${cwd}/esnext/tests/navigation.playwright.js`,
        `${cwd}/esnext/tests/navigation.playwright.wpt.js`,
        `${cwd}/esnext/tests/dependencies-input.js`,
        `${cwd}/esnext/tests/dependencies.js`,
        "./app-history.playwright.js",
        "./app-history.playwright.wpt.js",
      ]),
      nodeResolve()
    ],
    inlineDynamicImports: true,
    treeshake: {
      preset: "smallest",
      moduleSideEffects: "no-external"
    }
  });
  await bundle.write({
    sourcemap: true,
    output: {
      file: "./esnext/polyfill-rollup.js",
    },
    inlineDynamicImports: true,
    format: "cjs",
    interop: "auto",
    globals: {

    }
  });
}

if (!process.env.NO_COVERAGE_BADGE_UPDATE) {

  const badges = [];

  const { name } = await fs.readFile("package.json", "utf-8").then(JSON.parse);

  badges.push(
      '### Support\n\n',
      '![Node.js supported](https://img.shields.io/badge/node-%3E%3D16.0.0-blue)',
      '![Deno supported](https://img.shields.io/badge/deno-%3E%3D1.17.0-blue)',
      '![Bun supported](https://img.shields.io/badge/bun-%3E%3D0.1.11-blue)',
      '![Chromium supported](https://img.shields.io/badge/chromium-%3E%3D98.0.4695.0-blue)',
      '![Webkit supported](https://img.shields.io/badge/webkit-%3E%3D15.4-blue)',
      '![Firefox supported](https://img.shields.io/badge/firefox-%3E%3D94.0.1-blue)\n\n'
  )

  badges.push(
      '<details><summary>Test Coverage</summary>\n\n',
      // `![nycrc config on GitHub](https://img.shields.io/nycrc/${name.replace(/^@/, "")})`
  )

  const wptResults = await fs.readFile("coverage/wpt.results.json", "utf8").then(JSON.parse).catch(() => ({}));
  if (wptResults?.pass) {
    const message = `${wptResults.pass}/${wptResults.pass + wptResults.fail}`;
    const name = "Web Platform Tests";
    badges.push(
        `![${name} ${message}](https://img.shields.io/badge/${encodeURIComponent(name)}-${encodeURIComponent(message)}-brightgreen)`
    )
  }

  const coverage = await fs.readFile("coverage/coverage-summary.json", "utf8").then(JSON.parse).catch(() => ({}));
  const coverageConfig = await fs.readFile(".nycrc", "utf8").then(JSON.parse);
  for (const [name, { pct }] of Object.entries(coverage?.total ?? {})) {
    const good = coverageConfig[name];
    if (!good) continue; // not configured
    const color = pct >= good ? "brightgreen" : "yellow";
    const message = `${pct}%25`;
    badges.push(
        `![${message} ${name} covered](https://img.shields.io/badge/${name}-${message}-${color})`
    );
  }

  badges.push("\n\n</details>");

  const tag = "[//]: # (badges)";

  const readMe = await fs.readFile("README.md", "utf8");
  const badgeStart = readMe.indexOf(tag);
  const badgeStartAfter = badgeStart + tag.length;
  if (badgeStart === -1) {
    throw new Error(`Expected to find "${tag}" in README.md`);
  }
  const badgeEnd = badgeStartAfter + readMe.slice(badgeStartAfter).indexOf(tag);
  const badgeEndAfter = badgeEnd + tag.length;
  const readMeBefore = readMe.slice(0, badgeStart);
  const readMeAfter = readMe.slice(badgeEndAfter);

  const readMeNext = `${readMeBefore}${tag}\n\n${badges.join(" ")}\n\n${tag}${readMeAfter}`;
  await fs.writeFile("README.md", readMeNext);
  console.log("Wrote coverage badges!");
}


{
  async function rollupReplacements(fileName) {
    let file = await fs.readFile(fileName, "utf-8");

    const importUuidMarker = "/** post rollup replace importUuid **/",
        importJsonMarker = "/** post rollup replace json **/";

    function replaceInsideMarkers(marker, replacement) {
      const startIndex = file.indexOf(marker),
          endIndex = file.lastIndexOf(marker) + marker.length;

      const fileStart = file.slice(0, startIndex - 1),
          fileEnd = file.slice(endIndex + 1);

      const replacing = file.slice(startIndex, endIndex);

      if (typeof replacement === "function") {
        replacement = replacement(replacing.replaceAll(marker, ""));
      }

      file = `${fileStart}\n\n${replacement}\n\n${fileEnd}`
    }

    replaceInsideMarkers(importUuidMarker, "const getUuidModule = () => index;")
    replaceInsideMarkers(importJsonMarker, "const getStructuredClone = () => json;");

    await fs.writeFile(fileName, file);
  }

  await rollupReplacements("esnext/polyfill-rollup.js");

  await fs.cp("esnext/rollup.js", "esnext/rollup-input.cjs");

  await rollupReplacements("esnext/rollup-input.cjs");


  {

    const bundle = await rollup({
      input: "./esnext/rollup-input.cjs",
      plugins: [
        ignore([
          `${cwd}/esnext/tests/navigation.playwright.js`,
          `${cwd}/esnext/tests/navigation.playwright.wpt.js`,
          `${cwd}/esnext/tests/dependencies-input.js`,
          `${cwd}/esnext/tests/dependencies.js`,
        ]),
        nodeResolve()
      ],
      inlineDynamicImports: true,
      treeshake: {
        preset: "smallest",
        moduleSideEffects: "no-external"
      }
    });
    await bundle.write({
      sourcemap: true,
      file: "./esnext/rollup.cjs",
      inlineDynamicImports: true,
      format: "cjs",
      interop: "esModule",
      globals: {

      }
    });
  }

  await fs.rm("./esnext/rollup-input.cjs");

  await fs.cp("esnext/polyfill-rollup.js", "example/polyfill-rollup.js");
  await fs.cp("esnext/routes-rollup.js", "example/routes-rollup.js");
  await fs.cp("esnext/rollup.js", "example/rollup.js");

}