import { groupSymbol, writer } from "../ci/writer.ts";
import type { Message } from "@rex/primitives";
import type {
    DeploymentCompleted,
    DeploymentFailed,
    DeploymentSkipped,
    DeploymentStarted,
    MissingDeploymentDependencies,
    CyclicalDeploymentReferences
} from "./messages.ts";
import { green, red } from "@bearz/ansi/styles";
import { AnsiMode, AnsiSettings, rgb24 } from "@bearz/ansi";

export function deployConsoleSink(message: Message): void {
    switch(message.kind) {
        case "job:missing-dependencies": {
            const msg = message as MissingDeploymentDependencies;
            writer.error(`Missing the following job dependencies ${msg.deployments.join(",")}`)
            return;
        }

        case "job:cyclical-references": {
            const msg = message as CyclicalDeploymentReferences
            writer.error(`Found job cyclical references ${msg.deployments.join(",")}`)
            return;
        }

        case "job:started": {
            const msg = message as DeploymentStarted;
            const name = msg.state.name ?? msg.state.id;
            writer.startGroup(`${name}`);
            return;
        }

        case "job:skipped": {
            const msg = message as DeploymentSkipped;
            const name = msg.state.name ?? msg.state.id;
            writer.skipGroup(name);
            return;
        }

        case "deployment:failed": {
            const msg = message as DeploymentFailed;
            const name = msg.state.name ?? msg.state.id;
            writer.error(msg.error);
            if (AnsiSettings.current.mode === AnsiMode.TwentyFourBit) {
                writer.write(groupSymbol);
                writer.writeLine(`${name} ${red("failed")}`);
            } else if (AnsiSettings.current.mode === AnsiMode.None) {
                writer.error(`❯❯❯❯❯ ${name} failed`);
            } else {
                writer.error(red(`❯❯❯❯❯ ${name} failed`));
            }
            
            writer.endGroup();
            return;
        }

        case "deployment:completed": {
            const msg = message as DeploymentCompleted;
            const duration = msg.result.finishedAt.getTime() - msg.result.startedAt.getTime();
            const ms = duration % 1000;
            const s = Math.floor(duration / 1000) % 60;
            const m = Math.floor(duration / 60000) % 60;

            if (AnsiSettings.current.mode === AnsiMode.TwentyFourBit) {
                // rexWriter.write(groupSymbol)
                writer.write(groupSymbol);
                writer.writeLine(
                    ` ${rgb24(msg.state.name ?? msg.state.id, 0xb400ff)} completed sucessfully in ${
                        green(m.toString())
                    }m ${green(s.toString())}s ${green(ms.toString())}ms`,
                );
            } else {
                writer.success(
                    `${msg.state.name ?? msg.state.id} completed in ${m}m ${s}s ${ms}ms`,
                );
            }

            writer.endGroup();
            return;
        }
    }
}