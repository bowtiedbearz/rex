import type { AnsiWriter } from "@bearz/ansi";
import type { Outputs, ProxyMap, StringMap } from "../collections/mod.ts";

export interface Context extends Record<string, unknown> {
    signal: AbortSignal;
    env: StringMap;
    variables: StringMap;
    writer: AnsiWriter;
    secrets: StringMap;
    services: ProxyMap<unknown>;
}

export interface ExecutionContext extends Context {
    outputs: Outputs;

    cwd: string;
}
