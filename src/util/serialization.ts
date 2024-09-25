let _stringify = JSON.stringify.bind(JSON);
let _parse = JSON.parse.bind(JSON);

export function configureSerialization(stringify: typeof JSON.stringify, parse: typeof JSON.parse) {
    _stringify = stringify;
    _parse = parse;
}

export function stringify(value: unknown) {
    return _stringify(value);
}

export function parse(value: string) {
    return _parse(value);
}