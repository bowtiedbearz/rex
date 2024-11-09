import type { Message } from "./bus.ts";

export class BaseMessage implements Message {

    constructor(public readonly kind: string) {

    }

    [key: string]: unknown;
}
