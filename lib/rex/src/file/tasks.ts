import { StringMap, Inputs } from "../collections/mod.ts";
import { tasks } from "./globals.ts";
import type { DelegateTask, RunDelegate, Task, TaskContext } from "../pipelines/tasks/primitives.ts";
import { shells } from "./scripting.ts";
import { output } from "../pipelines/utils.ts";

export class TaskBuilder {
    #task: Task;
    
    constructor(task: Task, global: boolean = false) {
        this.#task = task;
        if (global) {
            tasks()
        }
    }

    cwd(cwd: string | ((ctx: TaskContext) => string | Promise<string>)) : this {
        this.#task.cwd = cwd;
        return this;
    }

    description(description: string) : this {
        this.#task.description = description;
        return this;
    }

    env(env: Record<string, string> | StringMap | ((ctx: TaskContext) => StringMap | Promise<StringMap>)) : this {
        if (env instanceof StringMap) {
            this.#task.env = env;
            return this;
        }

        if (typeof env === 'function') {
            this.#task.env = env;
            return this;
        }

       
        this.#task.env = new StringMap();
        this.#task.env.merge(env);
        return this;
    }

    force(force: boolean | ((ctx: TaskContext) => boolean | Promise<boolean>)) : this {
        this.#task.force = force;
        return this;
    }

    if(condition: boolean | ((ctx: TaskContext) => boolean | Promise<boolean>)) : this {
        this.#task.if = condition;
        return this;
    }

    timeout(timeout: number | ((ctx: TaskContext) => number | Promise<number>)) : this {
        this.#task.timeout = timeout;
        return this;
    }

    with(inputs: Record<string, unknown> | Inputs | ((ctx: TaskContext) => Inputs | Promise<Inputs>)) : this {
        if (inputs instanceof Inputs) {
            this.#task.with = inputs;
            return this;
        }

        if (typeof inputs === 'function') {
            this.#task.with = inputs;
            return this;
        }

        this.#task.with = new Inputs();
        this.#task.with.merge(inputs);
        return this;
    }

    name(name: string) : this {
        this.#task.name = name;
        return this;
    }

    needs(...needs: string[]) : this {
        this.#task.needs = needs;
        return this;
    }

    build() : Task {
        return this.#task;
    }
}

export function usesTask(uses: string, id: string) : TaskBuilder {
    return new TaskBuilder({
        id: id,
        uses: uses,
        name: id,
        needs: [],
    }, true);
} 

export function task(id: string, needs: string[], rn: RunDelegate): TaskBuilder
export function task(id: string, fn: RunDelegate): TaskBuilder
export function task(): TaskBuilder {
    console.log(arguments   )
    const id = arguments[0]
    let fn = arguments[1]
    let needs : string[] = [];
    if (Array.isArray(fn)) {
        needs = fn
        fn = arguments[2]
    }

    const task  : DelegateTask = {
        id: id,
        uses: "delegate-task",
        name: id,
        needs: needs,
        run: fn
    }

    return new TaskBuilder(task, true);
}


export class ScriptTaskBuilder extends TaskBuilder {

    constructor(task: DelegateTask, global: boolean = false) {
        super(task, global);
    }
}

export function scriptTask(id: string, needs: string[], shell: string, script: string) : ScriptTaskBuilder
export function scriptTask(id: string, shell: string, script: string) : ScriptTaskBuilder
export function scriptTask(id: string, script: string) : ScriptTaskBuilder
export function scriptTask() : ScriptTaskBuilder {
    const id = arguments[0]
    let script : string = "";
    let shell : string | undefined = undefined;
    let needs : string[] = [];
    
    switch(arguments.length) {
        case 2:
            script = arguments[1]
            break;
        case 3:
            script = arguments[2]
            shell = arguments[1]
            break;

        case 4:
            needs = arguments[1]
            script = arguments[3]
            shell = arguments[2]
            break;

        default:
            throw new Error("Invalid number of arguments")
    }

    return new ScriptTaskBuilder({
        id: id,
        uses: "shell-task",
        needs: needs,
        run: async (ctx: TaskContext) => {
            const o = await shells.script(script, {
                shell: shell,
                cwd: ctx.state.cwd,
                env: ctx.state.env.toObject(),
                timeout: ctx.state.timeout
            }).run();

            if (o.code !== 0) {
                throw new Error(`The shell script for task ${id} failed with code ${o.code}`)
            }

            return output({
                code: o.code,
                shell: shell,
                cwd: ctx.state.cwd,
            });
        }
    })
}