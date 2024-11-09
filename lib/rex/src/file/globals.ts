import { JobMap } from "../pipelines/jobs/primitives.ts";
import { TaskMap, TaskRegistry } from "../pipelines/tasks/primitives.ts";

const g = globalThis as { REX_TASKS?: TaskMap, REX_REGISTRY?: TaskRegistry, REX_JOBS?: JobMap }

export function jobs() : JobMap {
    if (g.REX_JOBS === undefined) {
        g.REX_JOBS = new JobMap()
    }

    return g.REX_JOBS
}

export function tasks() : TaskMap {
    if (g.REX_TASKS === undefined) {
        g.REX_TASKS = new TaskMap()
    }

    return g.REX_TASKS
}

export function registry() : TaskRegistry {
    if (g.REX_REGISTRY === undefined) {
        g.REX_REGISTRY = new TaskRegistry()
    }

    return g.REX_REGISTRY
}