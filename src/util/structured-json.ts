
/** post rollup replace json **/
const structuredClone = (
    await getStructuredCloneModule()
        .catch(structuredCloneFallback)
)
const getStructuredClone = () => structuredClone
/** post rollup replace json **/

async function getStructuredCloneModule() {
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

export function stringify(value: unknown) {
    return getStructuredClone().stringify(value);
}

export function parse(value: string) {
    return getStructuredClone().parse(value);
}