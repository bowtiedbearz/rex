import type { RexPlugin } from "./plugin.ts";

export interface RexConfig {
    name?: string;
    version?: string;
    description?: string;
    include?: string[];
    plugin?: RexPlugin[];
}

export function config(config: RexConfig) : () => RexConfig {
    return () => config
}