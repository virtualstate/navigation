export const { stringify, parse } = await (
    getStructuredClone()
        .catch(structuredCloneFallback)
)

async function getStructuredClone() {
    const { stringify, parse } = await import("@ungap/structured-clone/json")
    return { stringify, parse };
}

function structuredCloneFallback() {
    const stringify = JSON.stringify.bind(JSON),
        parse = JSON.parse.bind(JSON);
    return {
        stringify,
        parse
    };
}