import {Request, RequestInit, Response} from "@opennetwork/http-representation";
import {RespondEvent} from "../../event-target/respond-event";
import {deferred} from "../../deferred";
import { dispatchEvent } from "../../event-target/global";

export interface FetchEvent extends RespondEvent<"fetch", Response> {

}

export async function fetch(url: string, init?: RequestInit & { signal?: AbortSignal }) {
    const request = new Request(url, init);
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