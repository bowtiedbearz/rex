import { AnsiLogLevel, AnsiMode, cyan, gray, green, magenta, red, rgb24, yellow } from "@bearz/ansi";
import { DefaultAnsiWriter } from "@bearz/ansi/writer";
import { CI, CI_DRIVER } from "./driver.ts";
import { sprintf } from "@bearz/fmt/printf";
import type { RexWriter } from "@rex/primitives/writer";
import { secretMasker } from "./secrets.ts";
import type { SecretMasker } from "@bearz/secrets/masker";
import { LogLevel } from "../../../primitives/src/log_level.ts";

function handleStack(stack?: string) {
    stack = stack ?? "";
    const index = stack.indexOf("\n");
    if (index === -1) {
        return stack;
    }

    return stack.substring(index + 1);
}

export function handleArguments(
    args: IArguments,
): { msg: string | undefined; stack: string | undefined } {
    let msg: string | undefined = undefined;
    let stack: string | undefined = undefined;

    switch (args.length) {
        case 0:
            return { msg, stack };
        case 1: {
            if (args[0] instanceof Error) {
                const e = args[0] as Error;
                msg = e.message;
                stack = handleStack(e.stack);
            } else {
                msg = args[0] as string;
            }

            return { msg, stack };
        }

        case 2: {
            if (args[0] instanceof Error) {
                const e = args[0] as Error;
                const message = args[1] as string;
                msg = message;
                stack = handleStack(e.stack);
            } else {
                const message = args[0] as string;
                const splat = Array.from(args).slice(1);
                msg = sprintf(message, ...splat);
            }
            return { msg, stack };
        }

        default: {
            if (args[0] instanceof Error) {
                const e = args[0] as Error;
                const message = args[1] as string;
                const splat = Array.from(args).slice(2);
                msg = sprintf(message, ...splat);
                stack = handleStack(e.stack);
            } else {
                const message = args[0] as string;
                const splat = Array.from(args).slice(1);
                msg = sprintf(message, ...splat);
            }

            return { msg, stack };
        }
    }
}


export const groupSymbol =
    "\x1b[38;2;255;0;0m❯\x1b[38;2;208;0;35m❯\x1b[38;2;160;0;70m❯[38;2;113;0;105m❯\x1b[38;2;65;0;140m❯\x1b[39m";


export class PipelineWriter extends DefaultAnsiWriter implements RexWriter {
    
    
    get secretMasker(): SecretMasker {
        return secretMasker;
    }

    setLogLevel(level: LogLevel): this {
        switch(level) {
            case LogLevel.Debug:
                this.level = AnsiLogLevel.Debug;
                return this;
            case LogLevel.Error:
                this.level = AnsiLogLevel.Error;
                return this;
            case LogLevel.Fatal:
                this.level = AnsiLogLevel.Error;
                return this;
            case LogLevel.Info:
                this.level = AnsiLogLevel.Information;
                return this;
            case LogLevel.Warn:
                this.level = AnsiLogLevel.Warning;
                return this;
            case LogLevel.Trace:
                this.level = AnsiLogLevel.Trace;
                return this;
        }

        return this;
    }
    
    /**
     * Write a command to the output.
     * @param command The name of the command.
     * @param args The arguments passed to the command.
     * @returns The writer instance.
     */
    override command(command: string, args: string[]): this {
        switch (CI_DRIVER) {
            case "azdo":
                this.writeLine(`##vso[command]${command} ${args.join(" ")}`);
                return this;
            default: {
                const fmt = `[CMD]: ${command} ${args.join(" ")}`;
                if (this.settings.stdout) {
                    this.writeLine(cyan(fmt));
                    return this;
                }
                this.writeLine(fmt);
                return this;
            }
        }
    }

    /**
     * Writes the progress of an operation to the output.
     * @param name The name of the progress indicator.
     * @param value The value of the progress indicator.
     * @returns The writer instance.
     */
    override progress(name: string, value: number): this {
        switch (CI_DRIVER) {
            case "azdo":
                this.writeLine(`##vso[task.setprogress value=${value};]${name}`);
                return this;
            default:
                if (CI) {
                    this.writeLine(`${name}: ${green(value + "%")}`);
                    return this;
                }

                this.write(`\r${name}: ${green(value + "%")}`);
                return this;
        }
    }

    /**
     * Start a new group of log messages.
     * @param name The name of the group.
     * @returns The writer instance.
     */
    override startGroup(name: string): this {
        switch (CI_DRIVER) {
            case "azdo":
                this.writeLine(`##[group]${name}`);
                return this;
            case "github":
                this.writeLine(`::group::${name}`);
                return this;
            default:
                if (this.settings.stdout === true) {
                    if (this.settings.mode === AnsiMode.TwentyFourBit) {
                        this.write(groupSymbol);
                        this.write(` ${rgb24(name, 0xb400ff)}`).writeLine();
                        return this;
                    }

                    this.writeLine(magenta(`❯❯❯❯❯ ${name}`));
                    return this;
                }

                this.writeLine(`❯❯❯❯❯ ${name}`);
               
                return this;
        }
    }

    skipGroup(name: string): this {
        switch (CI_DRIVER) {
            case "azdo":
                this.writeLine(`##[group]${name} (Skipped)`);
                this.endGroup();
                return this;

            case "github":
                this.writeLine(`::group::${name} (Skipped)`);
                this.endGroup();
                return this;

            default:
                if (this.settings.stdout === true) {
                    if (this.settings.mode === AnsiMode.TwentyFourBit) {
                        this.write(groupSymbol);
                        this.write(` ${rgb24(name, 0xb400ff)} (Skipped)`).writeLine();
                        this.endGroup();
                        return this;
                    }

                    this.writeLine(magenta(`❯❯❯❯❯ ${name} `) + gray("(Skipped)"));
                    this.endGroup();
                    return this;
                }

                this.writeLine(`❯❯❯❯❯ ${name} (Skipped)`);
                this.endGroup();
               
                return this;
        }
    }

    /**
     * Ends the current group.
     * @returns The writer instance.
     */
    override endGroup(): this {
        switch (CI_DRIVER) {
            case "azdo":
                this.writeLine("##[endgroup]");
                return this;
            case "github":
                this.writeLine("::endgroup::");
                return this;
            default:
                return this.writeLine()
        }
    }

    /**
     * Write a trace message to the output.
     * @param e The error to write.
     * @param message The message to write.
     * @param args The arguments to format the message.
     * @returns The writer instance.
     */
    override trace(e: Error, message?: string | undefined, ...args: unknown[]): this;
    /**
     * Write a trace message to the output.
     * @param message The message to write.
     * @param args The arguments to format the message.
     * @returns The writer instance.
     */
    override trace(message: string, ...args: unknown[]): this;
    override trace(): this {
        if (this.level < AnsiLogLevel.Debug) {
            return this;
        }

        const { msg, stack } = handleArguments(arguments);
        switch (CI_DRIVER) {
            case "azdo":
                this.writeLine(`##[debug] [TRACE] ${msg}`);
                if (stack) {
                    this.writeLine(stack);
                }
                return this;
            case "github":
                this.writeLine(`::debug:: [TRACE] ${msg}`);
                if (stack) {
                    this.writeLine(stack);
                }
                return this;
            default:
                {
                    if (this.settings.stdout) {
                        if(this.settings.mode === AnsiMode.TwentyFourBit) {
                            this.write(rgb24("❯ [TRACE]: ", 0xADADAD));
                        } else {
                            this.write(gray(`❯ [TRACE]: `));
                        }

                        this.writeLine(msg);
                        if (stack) {
                            this.writeLine(red(stack));
                        }
                        return this;
                    }
                    this.writeLine(`❯ [TRACE]: ${msg}`);
                    if (stack) {
                        this.writeLine(stack);
                    }
                }
                return this;
        }
    }

    /**
     * Write a debug message to the output.
     * @param e The error to write.
     * @param message The message to write.
     * @param args The arguments to format the message.
     * @returns The writer instance.
     */
    override info(e: Error, message?: string | undefined, ...args: unknown[]): this;
    /**
     * Write a debug message to the output.
     * @param message The debug message.
     * @param args The arguments to format the message.
     * @returns The writer instance.
     */
    override info(message: string, ...args: unknown[]): this;
    override info(): this {
        if (this.level < AnsiLogLevel.Debug) {
            return this;
        }

        const { msg, stack } = handleArguments(arguments);
        switch (CI_DRIVER) {
            case "azdo":
                this.writeLine(`##[debug]${msg}`);
                if (stack) {
                    this.writeLine(stack);
                }
                return this;
            case "github":
                this.writeLine(`::debug::${msg}`);
                if (stack) {
                    this.writeLine(stack);
                }
                return this;
            default:
                {
                    if (this.settings.stdout) {
                        if (this.settings.mode === AnsiMode.TwentyFourBit) {
                            this.write(rgb24("❯ [INFO]:  ", 0x0293FF));
                        } else {
                            this.write(cyan("❯ [INFO]:  "));
                        }

                        this.writeLine(msg);
                        if (stack) {
                            this.writeLine(red(stack));
                        }
                        return this;
                    }

                    this.writeLine(`❯ [INFO]:  ${msg}`);
                    if (stack) {
                        this.writeLine(stack);
                    }
                }
                return this;
        }
    }

    /**
     * Write a debug message to the output.
     * @param e The error to write.
     * @param message The message to write.
     * @param args The arguments to format the message.
     * @returns The writer instance.
     */
    override debug(e: Error, message?: string | undefined, ...args: unknown[]): this;
    /**
     * Write a debug message to the output.
     * @param message The debug message.
     * @param args The arguments to format the message.
     * @returns The writer instance.
     */
    override debug(message: string, ...args: unknown[]): this;
    override debug(): this {
        if (this.level < AnsiLogLevel.Debug) {
            return this;
        }

        const { msg, stack } = handleArguments(arguments);
        switch (CI_DRIVER) {
            case "azdo":
                this.writeLine(`##[debug]${msg}`);
                if (stack) {
                    this.writeLine(stack);
                }
                return this;
            case "github":
                this.writeLine(`::debug::${msg}`);
                if (stack) {
                    this.writeLine(stack);
                }
                return this;
            default:
                {
                    if (this.settings.stdout) {
                        this.write(gray("❯ [DEBUG]: "));
                        this.writeLine(msg);
                        if (stack) {
                            this.writeLine(red(stack));
                        }
                        return this;
                    }
                    this.writeLine(`❯ [DEBUG]: ${msg}`);
                    if (stack) {
                        this.writeLine(stack);
                    }
                }
                return this;
        }
    }

    fatal(e: Error, message?: string | undefined, ...args: unknown[]): this;
    /**
     * Write an error message to the output.
     * @param message The error message.
     * @param args The arguments to format the message.
     * @returns The writer instance.
     */
    fatal(message: string, ...args: unknown[]): this;
    fatal(): this {
        if (this.level < AnsiLogLevel.Error) {
            return this;
        }

        const { msg, stack } = handleArguments(arguments);
        switch (CI_DRIVER) {
            case "azdo":
                this.writeLine(`##[error] [FATAL] ${msg}`);
                if (stack) {
                    this.writeLine(red(stack));
                }

                return this;

            case "github":
                this.writeLine(`::error:: [FATAL] ${msg}`);
                if (stack) {
                    this.writeLine(red(stack));
                }
                return this;

            default:
                {
                    

                    if (this.settings.stdout) {
                        this.write(red("❯ [FATAL]: "));
                        this.writeLine(msg)
                        if (stack) {
                            this.writeLine(red(stack));
                        }
                        return this;
                    }

                    this.writeLine(`❯ [FATAL]: ${msg}`);
                    if (stack) {
                        this.writeLine(stack);
                    }
                }

                return this;
        }
    }

    override error(e: Error, message?: string | undefined, ...args: unknown[]): this;
    /**
     * Write an error message to the output.
     * @param message The error message.
     * @param args The arguments to format the message.
     * @returns The writer instance.
     */
    override error(message: string, ...args: unknown[]): this;
    override error(): this {
        if (this.level < AnsiLogLevel.Error) {
            return this;
        }

       

        const { msg, stack } = handleArguments(arguments);
        switch (CI_DRIVER) {
            case "azdo":
                this.writeLine(`##[error]${msg}`);
                if (stack) {
                    this.writeLine(red(stack));
                }

                return this;

            case "github":
                this.writeLine(`::error::${msg}`);
                if (stack) {
                    this.writeLine(red(stack));
                }
                return this;

            default:
                {
                    if (this.settings.stdout) {
                        this.write(red(`❯ [ERROR]: `));
                        this.writeLine(msg);
                        if (stack) {
                            this.writeLine(red(stack));
                        }
                        return this;
                    }

                    this.writeLine(`❯ [ERROR]: ${msg}`);
                    if (stack) {
                        this.writeLine(stack);
                    }
                }

                return this;
        }
    }

    override warn(e: Error, message?: string | undefined, ...args: unknown[]): this;
    /**
     * Write a warning message to the output.
     * @param message The warning message.
     * @param args The arguments to format the message.
     * @returns The writer instance.
     */
    override warn(message: string, ...args: unknown[]): this;
    override warn(): this {
        if (this.level < AnsiLogLevel.Warning) {
            return this;
        }

        const { msg, stack } = handleArguments(arguments);
        switch (CI_DRIVER) {
            case "azdo":
                this.writeLine(`##[warning]${msg}`);
                if (stack) {
                    this.writeLine(stack);
                }
                return this;
            case "github":
                this.writeLine(`::warning::${msg}`);
                if (stack) {
                    this.writeLine(stack);
                }
                return this;
            default:
                {
                    ;
                    if (this.settings.stdout) {
                        if (this.settings.mode === AnsiMode.TwentyFourBit) {
                            this.write(rgb24("❯ [WARN]:  ", 0xFF9D00));
                        } else {
                            this.write(yellow("❯ [WARN]:  "));
                        }

                        this.writeLine(msg);
                        if (stack) {
                            this.writeLine(red(stack));
                        }
                        return this;
                    }
                    this.writeLine(`❯ [WARN]:  ${msg}`);
                    if (stack) {
                        this.writeLine(stack);
                    }
                }
                return this;
        }
    }
}

export const writer: PipelineWriter = new PipelineWriter();