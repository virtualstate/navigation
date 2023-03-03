import { Navigation } from "../../spec/navigation";
import { NavigationSync } from "../../history";
import { ok } from "../util";
import {like} from "../../is";

export async function syncLocationExample(navigation: Navigation) {
  const sync = new NavigationSync({ navigation }),
    location = sync;

  const expectedHash = `#hash${Math.random()}`;

  location.hash = expectedHash;
  ok(location.hash === expectedHash);

  await finished(navigation);

  const expectedPathname = `/pathname/1/${Math.random()}`;
  location.pathname = expectedPathname;
  ok(location.pathname === expectedPathname);

  await finished(navigation);

  const searchParams = new URLSearchParams(location.search);
  searchParams.append("test", "test");
  location.search = searchParams.toString();
  ok(new URLSearchParams(location.search).get("test") === "test");

  await finished(navigation);
}

export async function syncHistoryExample(navigation: Navigation<Record<string, unknown>>) {
  const sync = new NavigationSync({ navigation }),
    history = sync;

  const expected = `expected${Math.random()}`;
  const expectedUrl = new URL(`https://example.com/${expected}/1`);
  history.pushState(
    {
      [expected]: expected,
    },
    "",
    expectedUrl
  );
  ok(!history.state);
  ok(navigation.currentEntry.getState()[expected] === expected);

  await finished(navigation);

  ok(navigation.currentEntry.url === expectedUrl.toString());

  await navigation.navigate("/1").finished;
  const value: unknown = like<Record<string, unknown>>(history.state) && history.state?.[expected]
  ok(value !== expected);
  await navigation.navigate("/2").finished;
  await navigation.navigate("/3").finished;

  history.back();

  await finished(navigation);
  ok(!history.state);
  ok(navigation.currentEntry.getState()?.[expected] !== expected);

  history.back();

  await finished(navigation);
  ok(!history.state);
  ok(navigation.currentEntry.getState()?.[expected] !== expected);

  history.back();

  await finished(navigation);

  ok(!history.state);
  ok(navigation.currentEntry.getState()[expected] === expected);
  ok(navigation.currentEntry.url === expectedUrl.toString());

  history.forward();

  await finished(navigation);
  ok(!history.state);
  ok(navigation.currentEntry.getState()?.[expected] !== expected);

  history.go(-1);

  await finished(navigation);
  ok(!history.state);
  ok(navigation.currentEntry.getState()[expected] === expected);

  history.go(1);

  await finished(navigation);
  ok(!history.state);
  ok(navigation.currentEntry.getState()?.[expected] !== expected);

  history.go(-1);

  await finished(navigation);
  ok(!history.state);
  ok(navigation.currentEntry.getState()[expected] === expected);

  history.go(0);

  await finished(navigation);
  ok(!history.state);
  ok(navigation.currentEntry.getState()[expected] === expected);
}

async function finished(navigation: Navigation) {
  ok(navigation.transition);
  ok(navigation.transition.finished);
  await navigation.transition.finished;
}
