
declare module "wpt-runner" {



    export default function runTests(testsPath: string, options: {
        rootURL?: string,
        setup?(window: Window): void,
        filter?(): unknown,
        reporter?: unknown
    }): Promise<number>
}