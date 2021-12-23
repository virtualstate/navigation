import "./correct-import-extensions.js";
import { promises as fs } from "fs";
import { rollup } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import ignore from "rollup-plugin-ignore";
import babel from "rollup-plugin-babel";

const bundle = await rollup({
  input: "./esnext/tests/index.js",
  plugins: [
    ignore([
      "playwright",
      "fs",
      "path",
      "uuid",
      "@virtualstate/app-history",
      "@virtualstate/app-history-imported"
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
    "esnext/tests/app-history.playwright.js": "globalThis"
  }
});

if (!process.env.NO_COVERAGE_BADGE_UPDATE) {

  const badges = [];

  const { name } = await fs.readFile("package.json", "utf-8").then(JSON.parse);

  badges.push(
      '### Platforms\n\n',
      '- ![Node.js supported](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)\n',
      '- ![Deno supported](https://img.shields.io/badge/deno-%3E%3D1.17.0-brightgreen)\n',
      '- ![Chromium supported](https://img.shields.io/badge/chromium-%3E%3D98.0.4695.0-brightgreen)\n',
      '- ![Webkit supported](https://img.shields.io/badge/webkit-%3E%3D15.4-brightgreen)\n',
      '- ![Firefox supported](https://img.shields.io/badge/firefox-%3E%3D94.0.1-brightgreen)\n\n'
  )

  badges.push(
      '### Test Coverage\n\n',
      `- ![nycrc config on GitHub](https://img.shields.io/nycrc/${name.replace(/^@/, "")})\n`
  )

  const coverage = await fs.readFile("coverage/coverage-summary.json", "utf8").then(JSON.parse).catch(() => ({}));
  const coverageConfig = await fs.readFile(".nycrc", "utf8").then(JSON.parse);
  for (const [name, { pct }] of Object.entries(coverage?.total ?? {})) {
    const good = coverageConfig[name];
    if (!good) continue; // not configured
    const color = pct >= good ? "brightgreen" : "yellow";
    const message = `${pct}%25`;
    badges.push(
        `- ![${message} ${name} covered](https://img.shields.io/badge/${name}-${message}-${color})\n`
    );
  }

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

