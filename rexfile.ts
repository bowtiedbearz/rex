import { WINDOWS } from "@bearz/runtime-info/os";
import { cmd, task, scriptTask, job } from "./lib/rex/src/mod.ts";

task("test", (_) => {
    console.log("Hello, world!");
});

task("default", ["test"], async (_) => {
    await cmd("echo", ["Hello, world!"]).run();
});

scriptTask("test:bash", "bash", "echo 'Hello, world!' \n ls -la");

job("build").tasks((map, get) => {
    const test = get("test");
    if (test) {
        map.add("test", test);
    }

    task("test:2", () => console.log("test 2"), map).if(_ => WINDOWS)
})