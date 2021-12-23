import {Request, Response} from "@opennetwork/http-representation";
import {RespondEvent} from "../../event-target/respond-event";
import {deferred} from "../../util/deferred";
import { dispatchEvent } from "../../event-target/global";

export interface FetchEvent extends RespondEvent<"fetch", Response> {
    request: Request
}

export interface RequestInit {
    body?: string;
    headers?: Record<string, string>;
    method?: "get" | "post" | "put" | "delete";
    signal?: AbortSignal;
}

export async function fetch(url: string, init?: RequestInit) {
    const request = new Request(new URL(url, "https://example.com").toString(), init);
    const { resolve, reject, promise } = deferred<Response>();
    const event: FetchEvent = {
        type: "fetch",
        request,
        signal: init?.signal,
        respondWith(value) {
            Promise.resolve(value).then(resolve, reject)
        }
    };
    await dispatchEvent(event);
    return await promise;
}