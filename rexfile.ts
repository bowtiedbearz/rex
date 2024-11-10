import { cmd, task } from "./lib/rex/src/file/mod.ts";

task("test", (_) => {
    console.log("Hello, world!");
});

task("default", ["test"], async (_) => {
    await cmd("echo", ["Hello, world!"]).run();
});
