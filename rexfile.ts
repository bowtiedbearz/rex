import { cmd, task, scriptTask } from "./lib/rex/src/file/mod.ts";

task("test", (_) => {
    console.log("Hello, world!");
});

task("default", ["test"], async (_) => {
    await cmd("echo", ["Hello, world!"]).run();
});

scriptTask("test:bash", "bash", "echo 'Hello, world!' \n ls -la");