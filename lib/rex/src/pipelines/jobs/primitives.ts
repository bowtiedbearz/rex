import { fail, ok, type Result } from "@bearz/functional";
import { OrderedMap, type Inputs, type Outputs, type StringMap } from "../../collections/mod.ts";
import type { ExecutionContext } from "../contexts.ts";
import type { Task } from "../tasks/primitives.ts";

export interface JobContext extends ExecutionContext {
    state: JobState;
}

export interface JobState extends Record<string, unknown> {
    id: string;

    name: string;

    with: Inputs;

    env: StringMap;

    tasks: Task[];

    needs: string[];

    outputs: Outputs;

    if: boolean;

    timeout: number;
}

export interface Job extends Record<string, unknown> {
    id: string;

    name?: string;

    with?: Inputs | ((ctx: JobContext) => Inputs | Promise<Inputs>);

    env?: StringMap | ((ctx: JobContext) => StringMap | Promise<StringMap>);

    timeout?: number | ((ctx: JobContext) => number | Promise<number>);

    if?: boolean | ((ctx: JobContext) => boolean | Promise<boolean>);

    tasks: Task[];

    needs: string[];
}

function flatten(map: JobMap, set: Job[]) : Result<Job[]> {
    const results = new Array<Job>();
    for (const task of set) {
        if (!task) {
            continue;
        }

        for (const dep of task.needs) {
            const depTask = map.get(dep);
            if (!depTask) {
               return fail(new Error(`Task ${task.id} depends on missing task ${dep}`));
            }

            const depResult = flatten(map, [depTask]);
            if (depResult.isError)
                return depResult;

            
            results.push(...depResult.unwrap());
            if (!results.includes(depTask)) {
                results.push(depTask);
            }
        }

        if (!results.includes(task)) {
            results.push(task);
        }
    }

    return ok(results);
}

export class JobMap extends OrderedMap<string, Job> {
    constructor() {
        super();
    }

    missingDependencies(): Array<{job:Job, missing: string[]}> {
        const missing = new Array<{job:Job, missing: string[]}>();
        for (const job of this.values()) {
            const missingDeps = job.needs.filter(dep => !this.has(dep));
            if (missingDeps.length > 0) {
                missing.push({job, missing: missingDeps});
            }
        }
        return missing
    }

    flatten(targets?: Job[]) : Result<Job[]> {
        targets = targets ?? Array.from(this.values());
        return flatten(this, targets);
    };


    findCyclycalReferences() : Job[] {
        const stack = new Set<Job>()
        const cycles = new Array<Job>();
        const resolve = (job: Job) => {
            if (stack.has(job)) {
                return false;
            }
    
            stack.add(job);
            for (const dep of job.needs) {
                const depTask = this.get(dep);
                if (!depTask) {
                    continue;
                }
    
                if(!resolve(depTask))
                    return false;
            }
    
            stack.delete(job);
    
            return true;
        };
    
        for (const task of this.values()) {
            if (!resolve(task))
            {
                // cycle detected
                cycles.push(task);
            }
        }
    
        // no cycles detected
        return cycles;
    }
}