export interface Event<Name extends string | symbol = string | symbol> {
    type: Name
    parallel?: boolean
    signal?: {
        aborted: boolean
    }
    [key: string]: unknown
    [key: number]: unknown
}

export function isEvent(value: object): value is Event {
    return value.hasOwnProperty("type")
}
