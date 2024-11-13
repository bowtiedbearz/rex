import { Inputs, Outputs, StringMap } from "@rex/primitives";
import { REX_DEPLOYMENTS, REX_DEPLOYMENT_REGISTRY } from "./globals.ts";
import { output, toError } from "@rex/tasks";
import type { Deployment, DeploymentContext, DeploymentMap, Deploy, DelegateDeployment } from "./primitives.ts";
import { type Result, fail, ok } from "@bearz/functional";

export class DeploymentBuilder {
    #deployment: Deployment;

    constructor(deployment: Deployment, map?: DeploymentMap) {
        this.#deployment = deployment;
        map ??= REX_DEPLOYMENTS;
        map.set(deployment.id, deployment);
    }

    cwd(cwd: string | ((ctx: DeploymentContext) => string | Promise<string>)): this {
        this.#deployment.cwd = cwd;
        return this;
    }

    description(description: string): this {
        this.#deployment.description = description;
        return this;
    }

    env(
        env:
            | Record<string, string>
            | StringMap
            | ((ctx: DeploymentContext) => StringMap | Promise<StringMap>),
    ): this {
        if (env instanceof StringMap) {
            this.#deployment.env = env;
            return this;
        }

        if (typeof env === "function") {
            this.#deployment.env = env;
            return this;
        }

        this.#deployment.env = new StringMap();
        this.#deployment.env.merge(env);
        return this;
    }

    force(force: boolean | ((ctx: DeploymentContext) => boolean | Promise<boolean>)): this {
        this.#deployment.force = force;
        return this;
    }

    if(condition: boolean | ((ctx: DeploymentContext) => boolean | Promise<boolean>)): this {
        this.#deployment.if = condition;
        return this;
    }

    timeout(timeout: number | ((ctx: DeploymentContext) => number | Promise<number>)): this {
        this.#deployment.timeout = timeout;
        return this;
    }

    with(
        inputs: Record<string, unknown> | Inputs | ((ctx: DeploymentContext) => Inputs | Promise<Inputs>),
    ): this {
        if (inputs instanceof Inputs) {
            this.#deployment.with = inputs;
            return this;
        }

        if (typeof inputs === "function") {
            this.#deployment.with = inputs;
            return this;
        }

        this.#deployment.with = new Inputs();
        this.#deployment.with.merge(inputs);
        return this;
    }

    name(name: string): this {
        this.#deployment.name = name;
        return this;
    }

    needs(...needs: string[]): this {
        this.#deployment.needs = needs;
        return this;
    }

    build(): Deployment {
        return this.#deployment;
    }
}



export function deploy(id: string, needs: string[], rn: Deploy, tasks?: DeploymentMap): DeploymentBuilder;
export function deploy(id: string, fn: Deploy, tasks?: DeploymentMap): DeploymentBuilder;
export function deploy(): DeploymentBuilder {
    const id = arguments[0];
    let fn = arguments[1];
    let tasks: DeploymentMap | undefined = undefined;
    let needs: string[] = [];
    if (Array.isArray(fn)) {
        needs = fn;
        fn = arguments[2];
        if (arguments.length === 4) {
            tasks = arguments[3];
        }
    } else {
        if (arguments.length === 3) {
            tasks = arguments[2];
        }
    }

    const task: DelegateDeployment = {
        id: id,
        uses: "delegate-task",
        name: id,
        needs: needs,
        run: fn,
        hooks: {
            "before:deploy": [],
            "after:deploy": [],
        }
    };

    return new DeploymentBuilder(task, tasks);
}


const taskRegistry = REX_DEPLOYMENT_REGISTRY;
taskRegistry.set("delegate-task", {
    id: "delegate-task",
    description: "an inline task",
    inputs: [{
        name: "shell",
        description: "The shell to use",
        required: false,
        type: "string",
    }],
    outputs: [],
    run: async (ctx: DeploymentContext): Promise<Result<Outputs>> => {
        const task = ctx.task as DelegateDeployment;
        if (task.run === undefined) {
            return fail(new Error(`Task ${task.id} has no run function`));
        }

        try {
            const res = task.run(ctx);
            if (res instanceof Promise) {
                const out = await res;
                if (out instanceof Outputs) {
                    return ok(out);
                }

                return ok(output({}));
            }

            if (res instanceof Outputs) {
                return ok(res);
            }

            return ok(output({}));
        } catch (e) {
            return fail(toError(e));
        }
    },
});
