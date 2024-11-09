import { task } from "./file/mod.ts";

task("test", _ => {
    console.log("Hello, world!");
});

task("default", ["test"], _ => {
    console.log("Default task");
});  