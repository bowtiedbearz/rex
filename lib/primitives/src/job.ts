import type { Inputs, Outputs, StringMap } from "./collections.ts";
import type { ExecutionContext } from "./contexts.ts";
import type { Task } from "./task.ts";

export interface JobContext extends ExecutionContext {
    state: JobState;
}

export interface JobState extends Record<string, unknown> {
    id: string;

    name: string;

    with: Inputs;

    env: StringMap;

    tasks: Task[];

    needs: string[];

    outputs: Outputs;

    if: boolean;

    timeout: number;
}

export interface Job extends Record<string, unknown> {
    id: string;

    name?: string;

    with?: Inputs | ((ctx: JobContext) => Inputs | Promise<Inputs>);

    env?: StringMap | ((ctx: JobContext) => StringMap | Promise<StringMap>);

    timeout?: number | ((ctx: JobContext) => number | Promise<number>);

    if?: boolean | ((ctx: JobContext) => boolean | Promise<boolean>);

    tasks: Task[];

    needs: string[];
}