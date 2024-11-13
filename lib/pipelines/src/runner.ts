import { cwd as getCwd, exit } from "@bearz/process";
import { join } from "@std/path";
import { writer } from "./ci/writer.ts";
import { type ExecutionContext, Outputs, StringMap, ObjectMap } from "@rex/primitives";
import { DefaultLoggingMessageBus } from "./bus.ts";
import { tasksConsoleSink } from "./tasks/console_sink.ts";
import { jobsConsoleSink } from "./jobs/console_sink.ts";
import { deployConsoleSink } from "./deployments/console_sink.ts";
import { SequentialTasksPipeline, TaskPipeline, type TasksPipelineContext } from "./tasks/pipelines.ts";
import { env } from "@bearz/env";
import { DiscoveryPipeline, type DiscoveryPipelineContext } from "./discovery/pipeline.ts";
import { TaskMap, REX_TASKS_REGISTRY } from "@rex/tasks";
import { JobMap } from "@rex/jobs";
import { DeploymentMap } from "@rex/deployments";
import { RexfileDiscovery } from "./discovery/middlewares.ts";
import { ApplyTaskContext, SequentialTaskExecution, TaskExecution } from "./tasks/middlewares.ts";


export interface RunnerOptions {
    file?: string;
    cwd?: string;
    command?: string;
    targets?: string[];
    timeout?: number;
    runJobs?: boolean;
}

export class Runner {
    constructor() {
    }

    async run(options: RunnerOptions) {
        let { file, cwd, command, targets, timeout, } = options;
        

        cwd ??= getCwd();
        file ??= join(cwd, "rexfile.ts");

        timeout ??= 60 * 3;
        if (timeout < 1) {
            timeout = 60 * 3;
        }
        const controller = new AbortController();

        const handle = setTimeout(() => {
            controller.abort();
        }, timeout * 1000);

        const signal = controller.signal;

        try {
            signal.addEventListener("abort", () => {
                writer.error(`Timeout of ${timeout} seconds exceeded.`);
                exit(1);
            }, { once: true });

            command ??= "run";
            targets ??= ["default"];

            console.log("targets", targets);

            const bus = new DefaultLoggingMessageBus();
            bus.addListener(tasksConsoleSink);
            bus.addListener(jobsConsoleSink);
            bus.addListener(deployConsoleSink)

            const ctx: ExecutionContext = {
                services: new ObjectMap(),
                secrets: new StringMap(),
                variables: new ObjectMap(),
                env: new StringMap(),
                cwd: cwd,
                outputs: new Outputs(),
                writer: writer,
                bus: bus,
                signal: signal,
            };

            const discoveryPipeline = new DiscoveryPipeline();
            discoveryPipeline.use(new RexfileDiscovery());
            const taskPipeline = new TaskPipeline();
            taskPipeline.use(new ApplyTaskContext());
            taskPipeline.use(new TaskExecution());
            const tasksPipeline = new SequentialTasksPipeline();
            tasksPipeline.use(new SequentialTaskExecution());

            ctx.services.set("tasks-pipeline", new SequentialTasksPipeline());
            ctx.services.set("task-pipeline", new TaskPipeline());

            for (const [key, value] of Object.entries(env.toObject())) {
                if (value !== undefined) {
                    ctx.env.set(key, value);
                }
            }

            const discoveryContext: DiscoveryPipelineContext = Object.assign({}, ctx, {
                file: file,
                cwd: cwd,
                tasks: new TaskMap(),
                jobs: new JobMap(),
                deployments: new DeploymentMap(),
                bus: bus,
            });

            
            
            const res = await discoveryPipeline.run(discoveryContext);           

            switch (command) {
                case "task":
                case "run":
                    {
                
                        const tasksCtx: TasksPipelineContext = Object.assign({}, ctx, {
                            targets: targets,
                            tasks: res.tasks,
                            jobs: res.jobs,
                            registry: REX_TASKS_REGISTRY,
                            results: [],
                            status: "success",
                            bus: bus,
                        }) as TasksPipelineContext;

                        const pipeline = ctx.services.get(
                            "tasks-pipeline",
                        ) as SequentialTasksPipeline;
                        const results = await pipeline.run(
                            tasksCtx as unknown as TasksPipelineContext,
                        );
                        if (results.error) {
                            writer.error(results.error);
                            exit(1);
                        }

                        if (results.status === "failure") {
                            writer.error("Pipeline failed");
                            exit(1);
                        }
                        exit(0);
                    }

                    break;
                case "list":
                    writer.writeLine("Tasks:");
                    for (const [key, _] of res.tasks.entries()) {
                        writer.writeLine(`  ${key}`);
                    }
                    writer.writeLine("Jobs:");
                    for (const [key, _] of res.jobs.entries()) {
                        writer.writeLine(`  ${key}`);
                    }
                    break;
                default:
                    writer.error(`Unknown command: ${command}`);
                    exit(1);
            }
        } catch (error) {
            const e = error as Error;
            writer.error(e);
            exit(1);
        } finally {
            clearTimeout(handle);
        }
    }
}