import { Command } from "@cliffy/command";
import { runCommand } from "./cmds/run.ts";

const app = new Command()
    .name("rex")
    .description(
        "Rex is a developer's sidekick. It helps you automate tasks and manage your project.",
    )
    .version("0.0.1")
    .action(() => {
        app.showHelp();
    })
    .command("run", runCommand);

if (import.meta.main) {
    await app.parse(Deno.args);
}
