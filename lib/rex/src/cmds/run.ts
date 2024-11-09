import { Command } from "@cliffy/command";
import { Runner, type RunnerOptions } from "../pipelines/runner.ts";

export const runCommand = new Command()
    .name("rex-run")
    .description(
        "Rex is a developer's sidekick. It helps you automate tasks and manage your project.",
    )
    .version("0.0.1")
    .arguments("[target:string[]]")
    .option("-f, --file <file:string>", "The rexfile to run")
    .option("-l, --list", "List available tasks")
    .option("-t, --task <task:string>", "Run a specific task", { collect: true })
    .option("-j, --job <job:string>", "Run a specific job", { collect: true })
    .action(async ({ file, list, task, job }, targets) => {
        const runner = new Runner();
        const options: RunnerOptions = {
            file: file,
            targets: targets ?? task ?? job ?? ["default"],
            tasks: task === undefined ? true : false,
            jobs: job === undefined ? true : false,
            command: list ? "list" : "run",
        };
        await runner.run(options);
    });
