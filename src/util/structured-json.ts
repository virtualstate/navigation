export const { stringify, parse } = await import("@ungap/structured-clone/json")
    .catch(structuredCloneFallback)

function structuredCloneFallback() {
    const stringify = JSON.stringify.bind(JSON),
        parse = JSON.parse.bind(JSON);
    return {
        stringify,
        parse
    };
}