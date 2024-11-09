import type { ObjectMap, ProxyMap } from "./collections.ts";
import type { ExecutionContext } from "./contexts.ts";
import type { TaskDescriptor } from "./descriptors.ts";
import type { RexMiddleware } from "./middleware.ts";

export interface MiddlewaresExports {
    middlewares: {
        'task-pipeline': RexMiddleware[]
        'job-pipeline': RexMiddleware[]
        'discovery-pipeline': RexMiddleware[]
    }
}

export type Command = (executionContext: ExecutionContext) => void | Promise<void>

export interface RexPluginExports extends Record<string, unknown> {
    middlewares: MiddlewaresExports
    services: ObjectMap
    commands: ProxyMap<Command>
    tasks: ProxyMap<TaskDescriptor>
}

export abstract class RexPlugin {
    abstract apply(exports: RexPluginExports) : void
}