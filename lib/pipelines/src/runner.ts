import { cwd as getCwd, exit } from "@bearz/process";
import { join } from "@std/path";
import { writer } from "./ci/writer.ts";
import { type ExecutionContext, Outputs, StringMap, ObjectMap, LogLevel, Inputs } from "@rex/primitives";
import { DefaultLoggingMessageBus } from "./bus.ts";
import { tasksConsoleSink } from "./tasks/console_sink.ts";
import { jobsConsoleSink } from "./jobs/console_sink.ts";
import { deployConsoleSink } from "./deployments/console_sink.ts";
import { SequentialTasksPipeline, TaskPipeline, type TasksPipelineContext } from "./tasks/pipelines.ts";
import { env } from "@bearz/env";
import { DiscoveryPipeline, type DiscoveryPipelineContext } from "./discovery/pipelines.ts";
import { TaskMap, REX_TASKS_REGISTRY } from "@rex/tasks";
import { JobMap } from "@rex/jobs";
import { DeploymentMap, DeploymentResult, REX_DEPLOYMENT_REGISTRY } from "@rex/deployments";
import { RexfileDiscovery } from "./discovery/middlewares.ts";
import { ApplyTaskContext, SequentialTaskExecution, TaskExecution } from "./tasks/middlewares.ts";
import { type JobsPipelineContext, SequentialJobsPipeline } from "./jobs/mod.ts";
import { ApplyJobContext, JobsExcution, RunJob } from "./jobs/middleware.ts";
import { JobPipeline } from "./jobs/pipelines.ts";
import { DeploymentPipeline, type DeploymentPipelineContext } from "./deployments/pipelines.ts";
import { parse } from "@bearz/dotenv"
import { load } from "@bearz/dotenv/load"
import { readTextFile } from "@bearz/fs";
import { ApplyDeploymentContext, RunDeployment } from "./deployments/middleware.ts";


export interface RunnerOptions {
    file?: string;
    cwd?: string;
    command?: string;
    targets?: string[];
    timeout?: number;
    logLevel?: string;
    context?: string;
    env?: string[];
    envFile?: string[];
}

export class Runner {
    constructor() {
    }

    async run(options: RunnerOptions) {
        let { file, cwd, command, targets, timeout, logLevel } = options;
        
        if (!logLevel) {
            writer.setLogLevel(LogLevel.Info);
        } else {
            switch(logLevel) {
                case 'debug':
                    writer.setLogLevel(LogLevel.Debug);
                    break;
                case 'info':
                    writer.setLogLevel(LogLevel.Info);
                    break;
                case 'warn':
                    writer.setLogLevel(LogLevel.Warn);
                    break;
                case 'error':
                    writer.setLogLevel(LogLevel.Error);
                    break;
                case 'trace':
                    writer.setLogLevel(LogLevel.Trace);
                    break;
                default:
                    writer.setLogLevel(LogLevel.Info);
                    break;
            }
        }

        cwd ??= getCwd();

        if (options.envFile) {
            for (const file of options.envFile) {
                const content = await readTextFile(file);
                const records = parse(content);
                load(records);
            }
        }

        if (options.env) {
            for (const e of options.env) {
                const [key, value] = e.split("=");
                if (value.startsWith("'"))
                    env.set(key, value.slice(1, value.length - 1));
                else if (value.startsWith('"'))
                    env.set(key, value.slice(1, value.length - 1));
                else
                    env.set(key, value);
            }
        }

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
                environmentName: options.context ?? "local",
            };

            const discoveryPipeline = new DiscoveryPipeline();
            discoveryPipeline.use(new RexfileDiscovery());
            const taskPipeline = new TaskPipeline();
            // first will execute the last.
            taskPipeline.use(new TaskExecution());
            taskPipeline.use(new ApplyTaskContext());

            const tasksPipeline = new SequentialTasksPipeline();
            tasksPipeline.use(new SequentialTaskExecution());

            const jobsPipeline = new SequentialJobsPipeline();
            jobsPipeline.use(new JobsExcution());

            const jobPipeline = new JobPipeline();
            jobPipeline.use(new RunJob());
            jobPipeline.use(new ApplyJobContext());

            const deploymentPipeline = new DeploymentPipeline();
            deploymentPipeline.use(new RunDeployment())
            deploymentPipeline.use(new ApplyDeploymentContext())


            ctx.services.set("TasksPipeline", tasksPipeline);
            ctx.services.set("SequentialTasksPipeline", tasksPipeline);
            ctx.services.set("TaskPipeline", taskPipeline);
            ctx.services.set("JobsPipeline", jobsPipeline);
            ctx.services.set("SequentialJobsPipeline", jobsPipeline);
            ctx.services.set("JobPipeline", jobPipeline);
            ctx.services.set("DeploymentPipeline", deploymentPipeline);

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
                            registry: REX_TASKS_REGISTRY,
                            results: [],
                            status: "success",
                            bus: bus,
                            environmentName: options.context ?? "local",
                        }) as TasksPipelineContext;

                        
                        const results = await tasksPipeline.run(
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
                case "job": {
                    const jobsCtx: JobsPipelineContext = Object.assign({}, ctx, {
                        targets: targets,
                        tasks: res.tasks,
                        registry: REX_TASKS_REGISTRY,
                        results: [],
                        status: "success",
                        bus: bus,
                        jobs: res.jobs,
                        environmentName: options.context ?? "local",
                    }) as JobsPipelineContext;

                    
                    const results = await jobsPipeline.run(jobsCtx);
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
                    writer.writeLine("Deployments:");
                    for (const [key, _] of res.deployments.entries()) {
                        writer.writeLine(`  ${key}`);
                    }
                    break;
                case "deploy":
                    {
                        if (targets.length > 1) {
                            writer.error("Deploy command does not support multiple targets yet.");
                            exit(1);
                        }
                        
                        const deployment = res.deployments.get(targets[0]);
                        if (!deployment) {
                            writer.error(`Deployment ${targets[0]} not found`);
                            exit(1);
                            return;
                        }

                        if (deployment.needs.length > 0) {
                            writer.warn(`Deployment needs are are not supported yet`);
                        }

                        const deploymentsCtx: DeploymentPipelineContext =  {
                            deployment,
                            tasksRegistry: REX_TASKS_REGISTRY,
                            bus,
                            writer,
                            status: "success",
                            variables: new ObjectMap(),
                            services: ctx.services,
                            cwd: ctx.cwd,
                            deploymentsRegistry: REX_DEPLOYMENT_REGISTRY,
                            outputs: ctx.outputs,
                            secrets: ctx.secrets,
                            env: ctx.env,
                            environmentName: options.context ?? "local",
                            signal: ctx.signal,
                            events: {},
                            result: new DeploymentResult(deployment.id),
                            state: {
                                status: "success",
                                error: undefined,
                                id: deployment.id,
                                name: deployment.name ?? deployment.id,
                                description: deployment.description ?? "",
                                cwd: ctx.cwd,
                                outputs: new Outputs(),
                                env: new StringMap(),
                                deploy: true,
                                force: false,
                                needs: deployment.needs,
                                if: true,
                                timeout: 0,
                                inputs: new Inputs(),
                                uses: deployment.uses,
                            }
                        }

                        const results = await deploymentPipeline.run(deploymentsCtx);
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