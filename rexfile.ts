import { task } from "./lib/rex/src/file/mod.ts";

task("test", (_) => {
    console.log("Hello, world!");
});

task("default", ["test"], (_) => {
    console.log("Default task");
});
