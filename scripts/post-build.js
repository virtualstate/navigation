import "./correct-import-extensions.js";
import { promises as fs } from "fs";

if (!process.env.NO_COVERAGE_BADGE_UPDATE) {

  const badges = [];

  badges.push(
    `![nycrc config on GitHub](https://img.shields.io/nycrc/virtualstate/app-state)`
  )

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
