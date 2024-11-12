import type { LoggingMessageBus } from "../../message-bus/bus.ts";
import type { ExecutionContext } from "../contexts.ts";
import { Pipeline } from "../pipeline.ts";
import type { TasksSummary } from "../tasks/pipelines.ts";
import type { PipelineStatus, TaskMap, TaskResult } from "../tasks/primitives.ts";
import { toError } from "../utils.ts";
import type { DeployService, DeployServiceContext, DeployServiceRegistry } from "./primitives.ts";

export interface DeployServicePipelineContext extends DeployServiceContext {
    result: TaskResult;
    service: DeployService;
    tasks: TaskMap;
    bus: LoggingMessageBus;
    status: PipelineStatus;
    registry: DeployServiceRegistry;
}

export class DeployServicePipeline extends Pipeline<TaskResult, DeployServicePipelineContext> {
    constructor() {
        super();
        //this.use(execute);
        //this.use(applyContext);
    }

    override async run(ctx: DeployServicePipelineContext): Promise<TaskResult> {
        try {
            await this.pipe(ctx);
            return ctx.result;
        } catch (error) {
            ctx.status = "failure";
            const e = toError(error);
            ctx.result.fail(e);
            ctx.bus.error(e);
            return ctx.result;
        }
    }
}

export interface DeployServicesPipelineContext extends ExecutionContext {
    tasks: TaskMap;
    registry: DeployServiceRegistry;
    results: TaskResult[];
    status: PipelineStatus;
    error?: Error;
    bus: LoggingMessageBus;
    targets: string[];
}

export class SequentialTaskPipeline extends Pipeline<TasksSummary, DeployServicesPipelineContext> {
    constructor() {
        super();
    }

    override async run(ctx: DeployServicesPipelineContext): Promise<TasksSummary> {
        try {
            await this.pipe(ctx);
            return {
                results: ctx.results,
                status: ctx.status,
                error: ctx.error,
            };
        } catch (error) {
            ctx.status = "failure";
            const e = toError(error);
            ctx.error = e;
            return {
                results: ctx.results,
                status: ctx.status,
                error: e,
            };
        }
    }
}
