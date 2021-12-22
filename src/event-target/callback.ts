import {Event} from "./event"
import {EventDescriptor, EventDescriptorSymbol} from "./descriptor"

export interface SyncEventCallback<TargetEvent = unknown, This = unknown> {
    (this: This, event: TargetEvent): void
}

export interface EventCallback<TargetEvent extends Event = Event, This = unknown> {
    (this: This, event: TargetEvent): Promise<void> | void
}

export function matchEventCallback(type: string, callback?: EventCallback | Function, options?: unknown): (descriptor: EventDescriptor) => boolean {
    const optionsDescriptor = isOptionsDescriptor(options) ? options : undefined;
    return descriptor => {
        if (optionsDescriptor) {
            return optionsDescriptor === descriptor;
        }
        return (!callback || callback === descriptor.callback) && type === descriptor.type;
    }

    function isOptionsDescriptor(options: unknown): options is EventDescriptor {
        function isLike(options: unknown): options is Partial<EventDescriptor> {
            return !!options;
        }
        return isLike(options) && options[EventDescriptorSymbol] === true;
    }
}
