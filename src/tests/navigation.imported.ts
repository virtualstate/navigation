import {NavigationAssertFn, assertNavigation} from "./navigation";

try {
    const { Navigation } = (await import("@virtualstate/navigation-imported")) ?? { Navigation: undefined };
    if (Navigation) {
        const input = () => new Navigation();
        const fn: NavigationAssertFn = await assertNavigation(input);
        fn(input);
        console.log(`PASS assertNavigation:imported:new Navigation`);
    }
} catch {
    console.warn(`WARN FAILED assertNavigation:imported:new Navigation`);
}