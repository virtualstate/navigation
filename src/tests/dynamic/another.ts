export async function intercept(...args: unknown[]) {
    console.log("Another", { intercept: { args }});
}