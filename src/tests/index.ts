

process.on("uncaughtException", (...args) => {
    console.log("process uncaught exception", ...args);
    process.exit(1);
});
process.on("unhandledRejection", (...args) => {
    console.log("process unhandled rejection", ...args);
    process.exit(1);
});
process.on("error", (...args) => {
    console.log("process error", ...args);
    process.exit(1);
});

await import("./app-history.class");
await import("./app-history.imported");

// Settle tests, allow for the above handlers to fire if they need to
await new Promise(resolve => setTimeout(resolve, 200));

// TODO add checks to ensure everything is closed
process.exit(0);

export default 1;