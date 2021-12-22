

export interface DependenciesContentOptions {
    imports?: Record<string, string>
}

export async function DependenciesContent({ imports }: DependenciesContentOptions) {
    const { default: input } = await import("./dependencies-input");
    return JSON.stringify(
        {
            imports: Object.fromEntries(
                input
                    .filter((key: string) => typeof key === "string" && key)
                    .map((key: string) => [key, `https://cdn.skypack.dev/${key}`])
                    .concat(Object.entries(imports ?? {}))
            )
        }
    );
}