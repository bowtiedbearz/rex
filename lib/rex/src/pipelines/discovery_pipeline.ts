import { isAbsolute, join } from "@std/path";
import { jobs, tasks } from "../file/globals.ts";
import type { LoggingMessageBus } from "../message-bus/bus.ts";
import type { ExecutionContext } from "./contexts.ts";
import { JobMap } from "./jobs/primitives.ts";
import { type Next, Pipeline } from "./pipeline.ts";
import { TaskMap } from "./tasks/primitives.ts";
import { toError } from "./utils.ts";
import { exists, realPath } from "@bearz/fs";

export interface DiscoveryPipelineContext extends ExecutionContext {
    tasks: TaskMap;
    jobs: JobMap;
    file?: string;
    setup?: (ctx: ExecutionContext) => Promise<void> | void;
    teardown?: (ctx: ExecutionContext) => Promise<void> | void;
    bus: LoggingMessageBus;
    error?: Error;
}

export interface DicoveryPipelineResult {
    tasks: TaskMap;
    jobs: JobMap;
    error?: Error;
    file: string;
}

export interface RexFileImports {
    tasks?: TaskMap;
    setup?: (ctx: ExecutionContext) => Promise<void> | void;
    teardown?: (ctx: ExecutionContext) => Promise<void> | void;
    jobs?: JobMap;
}

async function rexfile<C>(context: C, next: Next): Promise<void> {
    const ctx = context as DiscoveryPipelineContext;
    try {
        const globalTasks = tasks();
        const globalJobs = jobs();
        let file = ctx.file;
        if (file && !file.endsWith(".ts")) {
            ctx.bus.warn(`Tasks file ${ctx.file} must be a typescript file.`);
            return;
        }

        let cwd = ctx.cwd;
        if (cwd.startsWith("http")) {
            const url = new URL(cwd);
            cwd = url.pathname;
        }

        if (file === undefined) {
            file = join(cwd, "rexfile.ts");
        }
        if (!isAbsolute(file)) {
            file = await realPath(file);
        }

        if (!await exists(file)) {
            file = join(cwd, ".rex", "tasks.ts");
        }

        if (!await exists(file)) {
            ctx.bus.warn(`No tasks file found at ${file}`);
            return;
        }

        if (!file.startsWith("http")) {
            file = `file://${file}`;
        }

        ctx.file = file;

        const mod = await import(file) as RexFileImports;

        if (!mod.tasks) {
            if (globalTasks.size === 0) {
                ctx.bus.debug(
                    `No tasks found in ${file}.  Task file must export a variable called tasks is type TaskMap.`,
                );
            } else {
                for (const [key, value] of globalTasks.entries()) {
                    ctx.tasks.set(key, value);
                }
            }
        } else {
            if (!(mod.tasks instanceof TaskMap)) {
                ctx.bus.error(
                    new Error(`Tasks in ${file} must be of type TaskMap`),
                    "Error collecting tasks",
                );
                return;
            }

            for (const [key, value] of mod.tasks.entries()) {
                ctx.tasks.set(key, value);
            }
        }

        if (!mod.jobs) {
            if (globalJobs.size === 0) {
                ctx.bus.debug(
                    `No jobs found in ${file}.  Rexfile file must export a variable called jobs is type JobMap.`,
                );
            } else {
                for (const [key, value] of globalJobs.entries()) {
                    ctx.jobs.set(key, value);
                }
            }
        } else {
            if (!(mod.jobs instanceof JobMap)) {
                ctx.bus.error(
                    new Error(`Jobs in ${file} must be of type JobMap`),
                    "Error collecting tasks",
                );
                return;
            }

            for (const [key, value] of mod.jobs.entries()) {
                ctx.jobs.set(key, value);
            }
        }

        if (mod.setup && typeof mod.setup === "function") {
            ctx.setup = mod.setup;
        }

        if (mod.teardown && typeof mod.teardown === "function") {
            ctx.teardown = mod.teardown;
        }

        await next();
    } catch (e) {
        const error = toError(e);
        ctx.error = error;
    }
}

export class DiscoveryPipeline extends Pipeline<DicoveryPipelineResult, DiscoveryPipelineContext> {
    constructor() {
        super();
        this.use(rexfile);
    }

    override async run(context: DiscoveryPipelineContext): Promise<DicoveryPipelineResult> {
        try {
            const ctx = await this.pipe(context);
            return { tasks: ctx.tasks, jobs: ctx.jobs, file: ctx.file ?? "", error: ctx.error };
        } catch (error) {
            const e = toError(error);
            return { tasks: new TaskMap(), jobs: new JobMap(), error: e, file: "" };
        }
    }
}
