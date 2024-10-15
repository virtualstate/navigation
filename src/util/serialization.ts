export interface Serializer {
    stringify(value: unknown): string;
    parse(value: string): unknown
}

let GLOBAL_SERIALIZER: Serializer = JSON;

export function setSerializer(serializer: Serializer) {
    GLOBAL_SERIALIZER = serializer;
}

export function stringify(value: unknown) {
    return GLOBAL_SERIALIZER.stringify(value);
}

export function parse(value: string) {
    return GLOBAL_SERIALIZER.parse(value);
}