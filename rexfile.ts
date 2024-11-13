import { WINDOWS } from "@bearz/runtime-info/os";
import { cmd, task, scriptTask, job } from "./lib/rex/src/mod.ts";
import { deploy } from "./lib/deployments/src/deployments.ts";

task("test", (_) => {
    console.log("Hello, world!");
});

task("default", ["test"], async (_) => {
    await cmd("echo", ["Hello, world!"]).run();
});

scriptTask("test:bash", "bash", "echo 'Hello, world!' \n ls -la");

task("print:env", (ctx) => {
    for(const [key, value] of ctx.env) {
        console.log(`${key}=${value}`);
    }
})
.description("Prints the environment variables")

job("build").tasks((map, add) => {
    add("test");
    task("test:2", () => console.log("test 2"), map).if(_ => WINDOWS)
})

deploy("moon", (ctx) => {
    console.log("deploying..")
    console.log(ctx.writer.level);
    ctx.writer.warn("Deploying to the moon");
    ctx.writer.info("Deploying to the moon");
})
.before((map) => {
    task("before:moon", () => console.log("before moon"), map);
})
.after((map) => {
    task("after:moon", () => console.log("after moon"), map);
});