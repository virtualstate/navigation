export async function parseDOM(input: string, querySelector: string) {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(input, "text/html")!;
    const element = doc.querySelector(querySelector);
    if (!element) {
      throw new Error("Expected elemenet");
    }
    return {
      title: doc.title,
      innerHTML: element.innerHTML,
    } as const;
  } else {
    const Cheerio = await import("cheerio");
    if (!Cheerio.load) throw new Error("Could not parse html");
    const $ = Cheerio.load(input);
    return {
      title: $("title").text() ?? "",
      innerHTML: $("main").html() ?? "",
    } as const;
  }
}
