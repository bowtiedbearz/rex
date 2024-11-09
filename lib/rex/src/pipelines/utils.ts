import { Outputs } from "../collections/mod.ts";

export function output(data: Record<string, unknown> | Outputs): Outputs {
    if (data instanceof Outputs) {
        return data;
    }

    const outputs = new Outputs();
    outputs.merge(data);
    return outputs;
}

export function toError(e: unknown): Error {
    return e instanceof Error ? e : new Error(`Unkown error: ${e}`);
}
