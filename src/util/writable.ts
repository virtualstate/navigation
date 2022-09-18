export type WritableProps<T> = { -readonly [P in keyof T]: T[P] };
