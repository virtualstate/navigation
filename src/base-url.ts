function getWindowBaseURL() {
    try {
        if (typeof window !== "undefined" && window.location) {
            return window.location.href;
        }
    } catch {}
}

export function getBaseURL(url?: string | URL) {
    const baseURL = getWindowBaseURL() ?? "https://html.spec.whatwg.org/";
    return new URL(
        // Deno wants this to be always a string
        (url ?? "").toString(),
        baseURL
    );
}