import { rexWriter } from "./writer.ts";
import { LogLevel, type LogMessage, type Message } from "../message-bus/bus.ts";
import type {
    TaskCompleted,
    TaskFailed,
    TaskSkipped,
    TaskStarted,
} from "../pipelines/tasks/messages.ts";
import { green, red } from "@bearz/ansi/styles";
import { AnsiMode, AnsiSettings, rgb24 } from "@bearz/ansi";

const groupSymbol =
    "\x1b[38;2;255;0;0m🢖\x1b[39m\x1b[38;2;208;0;35m🢖\x1b[39m\x1b[38;2;160;0;70m🢖\x1b[39m\x1b[38;2;113;0;105m🢖\x1b[39m\x1b[38;2;65;0;140m🢖\x1b[39m";

export function consoleSink(message: Message): void {
    switch (message.kind) {
        case "log":
            {
                const logMessage = message as LogMessage;
                if (!logMessage.error && !logMessage.message) {
                    return;
                }

                switch (message.level) {
                    case LogLevel.Info:
                        console.log;
                        if (logMessage.message) {
                            rexWriter.info(logMessage.message, message.args);
                        }

                        return;
                    case LogLevel.Debug:
                        if (logMessage.error) {
                            rexWriter.debug(logMessage.error, logMessage.message, message.args);
                        } else if (logMessage.message) {
                            rexWriter.debug(logMessage.message, message.args);
                        }

                        return;

                    case LogLevel.Warn:
                        if (logMessage.error) {
                            rexWriter.warn(logMessage.error, logMessage.message, message.args);
                        } else if (logMessage.message) {
                            rexWriter.warn(logMessage.message, message.args);
                        }

                        break;

                    case LogLevel.Error:
                        if (logMessage.error) {
                            rexWriter.error(logMessage.error, logMessage.message, message.args);
                        } else if (logMessage.message) {
                            rexWriter.error(logMessage.message, message.args);
                        }

                        break;
                }
                console.log(message.level, message.message, message.args);
            }

            break;

        case "task:started": {
            const msg = message as TaskStarted;
            const name = msg.task.name ?? msg.task.id;
            rexWriter.startGroup(`${name}`);
            return;
        }

        case "task:skipped": {
            const msg = message as TaskSkipped;
            const name = msg.task.name ?? msg.task.id;
            rexWriter.startSkipGroup(name);
            return;
        }

        case "task:failed": {
            const msg = message as TaskFailed;
            const name = msg.task.name ?? msg.task.id;
            if (AnsiSettings.current.mode === AnsiMode.TwentyFourBit) {
                rexWriter.write(groupSymbol);
                rexWriter.writeLine(`${name} ${red("failed")}`);
            } else if (AnsiSettings.current.mode === AnsiMode.None) {
                rexWriter.error(`🢖🢖🢖🢖🢖 Task ${name} failed`);
            } else {
                rexWriter.error(red(`🢖🢖🢖🢖🢖 Task ${name} failed`));
            }
            rexWriter.error(msg.error);
            rexWriter.endGroup();
            return;
        }

        case "task:completed": {
            const msg = message as TaskCompleted;
            const duration = msg.result.finishedAt.getTime() - msg.result.startedAt.getTime();
            const ms = duration % 1000;
            const s = Math.floor(duration / 1000) % 60;
            const m = Math.floor(duration / 60000) % 60;

            if (AnsiSettings.current.mode === AnsiMode.TwentyFourBit) {
                // rexWriter.write(groupSymbol)
                rexWriter.write(groupSymbol);
                rexWriter.writeLine(
                    ` ${rgb24(msg.task.name ?? msg.task.id, 0xb400ff)} completed sucessfully in ${
                        green(m.toString())
                    }m ${green(s.toString())}s ${green(ms.toString())}ms`,
                );
            } else {
                rexWriter.success(
                    `${msg.task.name ?? msg.task.id} completed in ${m}m ${s}s ${ms}ms`,
                );
            }

            rexWriter.endGroup();
            return;
        }
    }
}
