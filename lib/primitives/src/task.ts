import { type Result, ok, fail } from "@bearz/functional";
import { OrderedMap, type Inputs, type Outputs, type StringMap } from "./collections.ts";
import type { ExecutionContext } from "./contexts.ts";

export interface TaskContext extends ExecutionContext {
    state: TaskState;
}

export interface TaskState extends Record<string, unknown> {
    id: string;

    uses: string;

    name: string;

    description: string;

    inputs: Inputs

    outputs: Outputs

    force: boolean;

    timeout: number;

    if: boolean;

    env: StringMap;

    cwd: string;

    needs: string[];
}


export interface Task extends Record<string, unknown> {
    id: string;

    name?: string;

    description?: string;

    with?: Inputs | ((ctx: TaskContext) => Inputs | Promise<Inputs>);

    env?: StringMap | ((ctx: TaskContext) => StringMap | Promise<StringMap>);

    cwd?: string | ((ctx: TaskContext) => string | Promise<string>);

    timeout?: number | ((ctx: TaskContext) => number | Promise<number>);

    if?: boolean | ((ctx: TaskContext) => boolean | Promise<boolean>);

    force?: boolean | ((ctx: TaskContext) => boolean | Promise<boolean>);

    needs: string[];
}

export type RunDelegate = (ctx: TaskContext) => Promise<Outputs> | Promise<void> | Outputs | void;

export interface DelgateTaskState extends TaskState {
    run: RunDelegate;
}

export interface DelegateTask extends Task {
    run: RunDelegate;
}

