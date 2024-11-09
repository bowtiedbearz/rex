import { cwd as getCwd, exit } from "@bearz/process";
import { join } from "@std/path";
import { ExecutionContext } from "./contexts.ts";
import { ObjectMap, Outputs, StringMap } from "../collections/mod.ts";
import { PipelineWriter } from "@bearz/ci-env/writer";
import { env } from "@bearz/env";
import { TaskMap } from "./tasks/primitives.ts";
import { JobMap } from "./jobs/primitives.ts";
import { DiscoveryPipeline, DiscoveryPipelineContext } from "./discovery_pipeline.ts";
import { DefaultLoggingMessageBus, LoggingMessageBus } from "../message-bus/mod.ts";
import { SequentialTaskPipeline, TaskPipeline, TasksPipelineContext } from "./tasks/pipeline.ts";

export interface RunnerOptions {
    file?: string;
    cwd?: string;
    command?: string;
    targets?: string[];
    timeout?: number;
    tasks?: boolean;
    jobs?: boolean;
}

export class Runner {
    constructor() {
    }

    async run(option: RunnerOptions) {
        let { file, cwd, command, targets, timeout } = option;

        cwd ??= getCwd();
        file ??= join(cwd, "rexfile.ts");

        timeout ??= 60 * 3;
        if (timeout < 1) {
            timeout = 60 * 3;
        }
        const writer = new PipelineWriter();
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

            const bus = new DefaultLoggingMessageBus();
            bus.addListener((message) => {
                console.log(message)
            })

            const ctx: ExecutionContext = {
                services: new ObjectMap(),
                secrets: new StringMap(),
                variables: new StringMap(),
                env: new StringMap(),
                cwd: cwd,
                outputs: new Outputs(),
                writer: writer,
                bus: bus,
                signal: signal,
            };

            

            ctx.services.set("tasks-pipeline", new SequentialTaskPipeline());
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
                bus: ctx.bus as LoggingMessageBus,
            });

            const discoveryPipeline = new DiscoveryPipeline();
            const res = await discoveryPipeline.run(discoveryContext);

      

            switch (command) {
                case "run":
                    {
                        const tasksCtx  = Object.assign({}, ctx, {
                            targets: targets,
                            tasks: res.tasks,
                            jobs: res.jobs,
                        });

                        console.log(tasksCtx.tasks);

                        const pipeline = ctx.services.get("tasks-pipeline") as SequentialTaskPipeline;
                        const results = await pipeline.run(tasksCtx as unknown as TasksPipelineContext);
                        if (results.error) {
                            writer.error(results.error);
                            exit(1);
                        }

                        if (results.status === "failure") {
                            writer.error("Pipeline failed");
                            exit(1);
                        }

                        writer.success("Pipeline succeeded");
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
