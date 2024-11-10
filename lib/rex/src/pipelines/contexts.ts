import type { Outputs, ProxyMap, StringMap } from "../collections/mod.ts";
import type { RexWriter } from "../tui/writer.ts";

export interface Context extends Record<string, unknown> {
    signal: AbortSignal;
    env: StringMap;
    variables: StringMap;
    writer: RexWriter;
    secrets: StringMap;
    services: ProxyMap<unknown>;
}

export interface ExecutionContext extends Context {
    outputs: Outputs;

    cwd: string;
}
