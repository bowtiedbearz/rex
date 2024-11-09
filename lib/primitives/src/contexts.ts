import type { AnsiWriter } from "@bearz/ansi"
import { StringMap, ProxyMap, Outputs  } from "./collections.ts";
import { DefaultAnsiWriter } from "@bearz/ansi/writer";
import { env } from "@bearz/env";

export interface Context extends Record<string, unknown> {
    signal: AbortSignal;
    env: StringMap
    variables: StringMap;
    writer: AnsiWriter;
    secrets: StringMap;
    services: ProxyMap<unknown>
}

export interface ExecutionContext extends Context {
    
    outputs: Outputs;
  
    cwd: string;
}

