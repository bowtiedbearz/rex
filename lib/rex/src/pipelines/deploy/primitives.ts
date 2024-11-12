import { type Result, ok, fail } from "@bearz/functional";
import { OrderedMap, type Outputs, ProxyMap, } from "../../collections/mod.ts";
import type { ExecutionContext } from "../contexts.ts";
import type { InputDescriptor, OutputDescriptor } from "../descriptors.ts";
import type { TaskState } from "../tasks/primitives.ts";


export interface DeployServiceState extends TaskState {

    uses: 'docker' | string;

    deploy: true 

    /**
     * The other services that this service
     * depends on, which are run before this service.
     */
    needs: string[];
}

export interface DeployServiceContext extends ExecutionContext {
    state: DeployServiceState;
}

export interface DeployService extends Record<string, unknown> {
    uses: 'docker' | string;

    deploy: true;

    /**
     * The names of tasks that must
     * run before this task.
     */
    before: string[]

    /**
     * The name of tasks that must before the proxy
     * is updated.
     */
    beforeProxyUpdate: string[]
    /**
     * The names of tasks that must run after this task
     * in order.
     */
    after: string[]
    afterProxyUpdate: string[]

    /**
     * The other services that this service
     * depends on, which are run before this service.
     */
    needs: string[]
}

export type ServiceRunDelegate = (ctx: DeployServiceContext) => Promise<Outputs> | Promise<void> | Outputs | void;

export interface DelgateTaskState extends DeployServiceState {
    run: ServiceRunDelegate
}

export interface DelegateTask extends DeployService {
    run: ServiceRunDelegate
}

export interface DeployServiceDescriptor {
    id: string;
    import?: string;
    description?: string;
    inputs: InputDescriptor[];
    outputs: OutputDescriptor[];
    run(ctx: DeployServiceContext): Promise<Result<Outputs>>;
}


export class DeployServiceRegistry extends ProxyMap<DeployServiceDescriptor> {
    static fromObject(obj: Record<string, DeployServiceDescriptor>): DeployServiceRegistry {
        const map = new DeployServiceRegistry();
        for (const [key, value] of Object.entries(obj)) {
            map.set(key, value);
        }
        return map;
    }

    register(task: DeployServiceDescriptor): void {
        if (this.has(task.id)) {
            throw new Error(`Task ${task.id} already exists`);
        }

        this.set(task.id, task);
    }
}

function flatten(map: TaskMap, set: DeployService[]): Result<DeployService[]> {
    const results = new Array<DeployService>();
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
            if (depResult.isError) {
                return depResult;
            }

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

export class TaskMap extends OrderedMap<string, DeployService> {
    static fromObject(obj: Record<string, DeployService>): TaskMap {
        const map = new TaskMap();
        for (const [key, value] of Object.entries(obj)) {
            map.set(key, value);
        }
        return map;
    }

    missingDependencies(): Array<{ task: DeployService; missing: string[] }> {
        const missing = new Array<{ task: DeployService; missing: string[] }>();
        for (const task of this.values()) {
            const missingDeps = task.needs.filter((dep) => !this.has(dep));
            if (missingDeps.length > 0) {
                missing.push({ task, missing: missingDeps });
            }
        }
        return missing;
    }

    flatten(targets?: DeployService[]): Result<DeployService[]> {
        targets = targets ?? Array.from(this.values());
        return flatten(this, targets);
    }

    findCyclycalReferences(): DeployService[] {
        const stack = new Set<DeployService>();
        const cycles = new Array<DeployService>();
        const resolve = (task: DeployService) => {
            if (stack.has(task)) {
                return false;
            }

            stack.add(task);
            for (const dep of task.needs) {
                const depTask = this.get(dep);
                if (!depTask) {
                    continue;
                }

                if (!resolve(depTask)) {
                    return false;
                }
            }

            stack.delete(task);

            return true;
        };

        for (const task of this.values()) {
            if (!resolve(task)) {
                // cycle detected
                cycles.push(task);
            }
        }

        // no cycles detected
        return cycles;
    }
}