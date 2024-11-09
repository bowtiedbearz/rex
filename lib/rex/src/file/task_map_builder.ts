import {
    type DelegateTask,
    type RunDelegate,
    type TaskContext,
    TaskMap,
} from "../pipelines/tasks/primitives.ts";
import { ScriptTaskBuilder, TaskBuilder } from "./tasks.ts";
import { output } from "./../pipelines/utils.ts";
import { shells } from "./scripting.ts";

export class TaskMapBuilder {
    #map: TaskMap;

    constructor() {
        this.#map = new TaskMap();
    }

    usesTask(uses: string, id: string): TaskBuilder {
        return new TaskBuilder({
            id: id,
            uses: uses,
            name: id,
            needs: [],
        });
    }

    task(id: string, needs: string[], rn: RunDelegate): TaskBuilder;
    task(id: string, fn: RunDelegate): TaskBuilder;
    task(): TaskBuilder {
        const id = arguments[0];
        let fn = arguments[1];
        let needs: string[] = [];
        if (Array.isArray(fn)) {
            needs = fn;
            fn = arguments[2];
        }

        const task: DelegateTask = {
            id: id,
            uses: "delegate-task",
            name: id,
            needs: needs,
            run: fn,
        };

        return new TaskBuilder(task);
    }

    scriptTask(id: string, needs: string[], shell: string, script: string): ScriptTaskBuilder;
    scriptTask(id: string, shell: string, script: string): ScriptTaskBuilder;
    scriptTask(id: string, script: string): ScriptTaskBuilder;
    scriptTask(): ScriptTaskBuilder {
        const id = arguments[0];
        let script: string = "";
        let shell: string | undefined = undefined;
        let needs: string[] = [];

        switch (arguments.length) {
            case 2:
                script = arguments[1];
                break;
            case 3:
                script = arguments[2];
                shell = arguments[1];
                break;

            case 4:
                needs = arguments[1];
                script = arguments[3];
                shell = arguments[2];
                break;

            default:
                throw new Error("Invalid number of arguments");
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
                    timeout: ctx.state.timeout,
                }).run();

                if (o.code !== 0) {
                    throw new Error(`The shell script for task ${id} failed with code ${o.code}`);
                }

                return output({
                    code: o.code,
                    shell: shell,
                    cwd: ctx.state.cwd,
                });
            },
        });
    }

    build(): TaskMap {
        return this.#map;
    }
}
