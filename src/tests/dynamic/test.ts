export async function intercept(...args: unknown[]) {
    console.log("Test", { intercept: { args }});
}