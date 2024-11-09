import type { LoggingMessageBus } from "../../message-bus/mod.ts";
import { TaskResult, PipelineStatus, Task, TaskContext, TaskRegistry, TaskMap } from "./primitives.ts";
import { type Next, Pipeline, type RexMiddleware } from "../pipeline.ts";
import { toError } from "../utils.ts";
import { TaskCancelled, TaskSkipped, TaskCompleted, TaskFailed } from "./messages.ts";
import type { ExecutionContext } from "../contexts.ts";
import { underscore } from "@bearz/strings/underscore";
import { Inputs, Outputs, StringMap } from "../../collections/mod.ts";


export interface TaskPipelineContext extends TaskContext {
    result: TaskResult
    task: Task
    bus: LoggingMessageBus
    status: PipelineStatus
    registry: TaskRegistry
}

async function applyContext<C>(context: C, next: Next) : Promise<void> {
    const ctx = context as TaskPipelineContext;
    const meta = ctx.state;
    const task = ctx.task;

    

    try {
        meta.env.merge(ctx.env);

        if (typeof task.cwd === 'string') {
            meta.cwd = task.cwd;
        } else if (typeof task.cwd === 'function') {
            meta.cwd = await task.cwd(ctx);
        }
    
        if (typeof task.timeout === 'number') {
            meta.timeout = task.timeout;
        } else if (typeof task.timeout === 'function') {
            meta.timeout = await task.timeout(ctx);
        }
    
        if (typeof task.force === 'boolean') {
            meta.force = task.force;
        } else if (typeof task.force === 'function') {
            meta.force = await task.force(ctx);
        }
    
        if (typeof task.if === 'boolean') {
            meta.if = task.if;
        } else if (typeof task.if === 'function') {
            meta.if = await task.if(ctx);
        }
    
        if (typeof task.env === 'function') {
            const e = await task.env(ctx);
            meta.env.merge(e);
        } else if (typeof task.env === 'object') {
            const e = task.env;
            meta.env.merge(e);
        }
    
        if (typeof task.with === 'function') {
            meta.inputs = await task.with(ctx);
        } else if (typeof task.with !== 'undefined') {
            meta.inputs = task.with;
        }

        const descriptor = ctx.registry.get(meta.uses);
        if (!descriptor) {
            const error = new Error(`Task not found: ${meta.uses}`);
            ctx.result.fail(error);
            ctx.bus.send(new TaskFailed(meta, error));
            return;
        }

        const required = descriptor.inputs.filter(o => o.required).map(o => o.name)
    
        if (meta.inputs.size > 0) {
            for (const [key, value] of meta.inputs.entries()) {
                if (required.includes(key))
                    required.splice(required.indexOf(key), 1);

                const name = "INPUT_" + underscore(key, { screaming: true});
                let v = "";
                if (value !== null && value !== undefined) {
                    v = value.toString();
                }
    
                meta.env.set(name, v);
            }

            if (required.length > 0) {
                const error = new Error(`Missing required inputs for task ${task.id}: ${required.join(", ")}`);
                ctx.result.fail(error);
                ctx.bus.send(new TaskFailed(meta, error));
                return;
            }
        }
      
        await next();
    } catch (e) {
        ctx.result.stop();
        if (!(e instanceof Error)) {
            const e2 = new Error(`Unknown error: ${e}`);
            ctx.result.fail(e2);
            ctx.bus.send(new TaskFailed(meta, e2));
            return;
        }
        ctx.result.fail(e);
        ctx.bus.send(new TaskFailed(meta, e));
     
        return;
    }
}


async function execute<C>(context: C, next: Next) : Promise<void> {
    const ctx = context as TaskPipelineContext;
    const { state } = ctx;

    const descriptor = ctx.registry.get(state.uses);
    if (!descriptor) {
        const error = new Error(`Task not found: ${state.uses}`);
        ctx.result.fail(error);
        ctx.bus.send(new TaskFailed(ctx.state, error));
        return;
    }

    if(ctx.signal.aborted) {
        ctx.result.cancel();
        ctx.result.stop();
        ctx.bus.send(new TaskCancelled(ctx.state));
        return;
    }

    if (ctx.status === 'failure' || ctx.status === 'cancelled' && !state.force) {
        ctx.result.skip();
        ctx.result.stop();
        ctx.bus.send(new TaskSkipped(ctx.state));
        return;
    }

    if (state.if === false) {
        ctx.result.skip();
        ctx.result.stop();
        ctx.bus.send(new TaskSkipped(ctx.state));
        return;
    }

    let timeout = state.timeout;
    if (timeout === 0) {
        timeout = ctx.services.get("timeout") as number ?? (60 * 1000) * 3;
    } else {
        timeout = timeout * 1000
    }

    
    
    const controller = new AbortController();
    const onAbort = () => {
        controller.abort();
    };
    ctx.signal.addEventListener('abort', onAbort, { once: true });
    const signal = controller.signal;
    const listener = () => {
        ctx.result.cancel();
        ctx.result.stop();
        ctx.bus.send(new TaskCancelled(ctx.state));
    }

    signal.addEventListener('abort', listener, { once: true });
    const handle = setTimeout(() => {
        controller.abort();
    }, timeout);

    try {

         
        
        ctx.result.start(); 

        if (ctx.signal.aborted) {
            ctx.result.cancel();
            ctx.result.stop();
            ctx.bus.send(new TaskCancelled(ctx.state));
            return
        }

        const result = await descriptor.run(ctx);
        ctx.result.stop();
        if (result.isError) {
            ctx.result.stop();
            ctx.result.fail(result.unwrapError());
            return;
        }

        if(ctx.signal.aborted) {
            ctx.result.cancel();
            ctx.result.stop();
            ctx.bus.send(new TaskCancelled(ctx.state));
        }

        ctx.result.success();
        ctx.result.ouputs = result.unwrap();
    

    } finally {
        clearTimeout(handle);
        signal.removeEventListener('abort', listener);
        ctx.signal.removeEventListener('abort', onAbort);
    }

    await next();
}

export class TaskPipeline extends Pipeline<TaskResult, TaskPipelineContext> {

    constructor(){
        super();
        this.use(execute);
        this.use(applyContext);
    }
    
    override async run(ctx: TaskPipelineContext): Promise<TaskResult> {
        try {
            await this.pipe(ctx);
            return ctx.result
        } catch (error) {
           ctx.status = 'failure'
           const e = toError(error);
           ctx.result.fail(e)
           ctx.bus.error(e)
           return ctx.result;
        }
    }
}

export interface TasksPipelineContext extends ExecutionContext {
    tasks: TaskMap,
    registry: TaskRegistry
    results: TaskResult[]
    status: PipelineStatus
    error?: Error
    bus: LoggingMessageBus

}

export interface TasksSummary extends Record<string, unknown> {
    results: TaskResult[]
    error?: Error
    status: PipelineStatus
}

async function runTasks<C>(context: C, next: Next) : Promise<void> {
    const ctx = context as TasksPipelineContext;
    const { tasks } = ctx;

    for (const [_, task] of tasks) {
        const result = new TaskResult();

        if (ctx.status === 'failure' || ctx.status === 'cancelled') {
            if (task.force === undefined || task.force === false) {
                result.skip();
                ctx.results.push(result);
                continue;
            }
        }

        const bus = ctx.bus;
        const envData = new StringMap();
        envData.merge(ctx.env);
        const outputs = new Outputs();
        outputs.merge(ctx.outputs);

   
        const nextContext : TaskPipelineContext = {
            bus: bus,
            cwd: ctx.cwd,
            env: new StringMap().merge(envData),
            outputs,
            registry: ctx.registry,
            secrets: new StringMap().merge(ctx.secrets),
            signal: ctx.signal,
            services: ctx.services,
            variables: ctx.variables,
            result,
            task,
            status: 'success',
            writer: ctx.writer,
            state: {
                id: task.id,
                uses: task.uses,
                name: task.name ?? task.id,
                description: task.description ?? '',
                inputs: new Inputs(),
                outputs: new Outputs(),
                force: false,
                timeout: 0,
                if: true,
                env: new StringMap(),
                cwd: ctx.cwd,
                needs: task.needs
            }
        }

        const taskPipeline = new TaskPipeline();
        const r = await taskPipeline.run(nextContext);
        ctx.results.push(r);
        if (ctx.status !== 'failure') {
            if (r.status === 'failure') {
                ctx.status = 'failure';
                ctx.error = r.error;

                
                break;
            }

            if (r.status === 'cancelled') {
                ctx.status = 'cancelled';
                break;
            }
        }
    }

    await next();
}

export class SequentialTaskPipeline extends Pipeline<TasksSummary, TasksPipelineContext> {

    constructor(){
        super();
        this.use(runTasks);
    }

    override async run(ctx: TasksPipelineContext): Promise<TasksSummary> {
        try {
            await this.pipe(ctx);
            return  {
                results: ctx.results,
                status: ctx.status,
                error: ctx.error
            }
        } catch (error) {
           ctx.status = 'failure'
           const e = toError(error);
           ctx.error = e;
           return { 
                results: ctx.results,
                status: ctx.status,
                error: e
            }
        }
    }
}