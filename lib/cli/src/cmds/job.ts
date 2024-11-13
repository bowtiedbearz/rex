import { Command } from "@cliffy/command";
import { Runner, type RunnerOptions } from "@rex/pipelines/runner";
import { VERSION } from "../version.ts";

export const jobCommand = new Command()
    .name("rex-job")
    .description(
        "Rex is a developer's sidekick. It helps you automate tasks and manage your project.",
    )
    .version(VERSION)
    .arguments("[target:string[]]")
    .option("-f, --file <file:string>", "The rexfile to run")
    .option("-l, --list", "List available tasks")
    .option("--log-level <log-level:string>", "Enable debug mode", { default: "info" })
    .option("-t, --timeout <timeout:number>", "Set the timeout for the job")
    .option("-c --context <context:string>", "The context (environment) name. Defaults to 'local'", { default: "local" })
    .option("-e --env <env:string>", "Sets an environment variable", { collect: true })
    .option("--env-file <env-file:string>", "Sets an environment variable from a file", { collect: true })
    .action(async ({ file, list, logLevel, timeout, env, envFile, context  }, targets) => {
        const runner = new Runner();

        const options: RunnerOptions = {
            file: file,
            targets: targets ?? ["default"],
            command: list ? "list" : "job",
            timeout: timeout,
            logLevel: logLevel,
            env: env,
            envFile: envFile,
            context: context,
        };
        await runner.run(options);
    });
