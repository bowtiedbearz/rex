import { Command } from "@cliffy/command";
import { taskCommand } from "./cmds/task.ts";
import { jobCommand } from "./cmds/job.ts";
import { deployCommand } from "./cmds/deploy.ts";
import { VERSION } from "./version.ts";

const app = new Command()
    .name("rex")
    .description(
        "Rex is a developer's sidekick. It helps you automate tasks and manage your project.",
    )
    .version(VERSION)
    .action(() => {
        app.showHelp();
    })
    .command("task", taskCommand)
    .command("job", jobCommand)
    .command("deploy", deployCommand);

if (import.meta.main) {
    await app.parse(Deno.args);
}
