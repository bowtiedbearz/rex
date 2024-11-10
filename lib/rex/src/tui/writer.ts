import { CI_DRIVER, PipelineWriter } from "@bearz/ci-env";
import { stdout } from "@bearz/process";
import { AnsiSettings } from "@bearz/ansi/settings";
import { AnsiLogLevel, AnsiMode } from "@bearz/ansi/enums";
import { cyan, gray, magenta, rgb24 } from "@bearz/ansi/styles";
import { DefaultSecretMasker, type SecretMasker } from "@bearz/secrets";
import { setLogger } from "@bearz/exec/set-logger";

const groupSymbol =
    "\x1b[38;2;255;0;0m🢖\x1b[39m\x1b[38;2;208;0;35m🢖\x1b[39m\x1b[38;2;160;0;70m🢖\x1b[39m\x1b[38;2;113;0;105m🢖\x1b[39m\x1b[38;2;65;0;140m🢖\x1b[39m";
const groupBytes = new TextEncoder().encode(groupSymbol);

export class RexWriter extends PipelineWriter {
    #secretMasker: SecretMasker = new DefaultSecretMasker();

    constructor() {
        super();
        this.level = AnsiLogLevel.Information;
    }

    get secretMasker(): SecretMasker {
        return this.#secretMasker;
    }

    override command(command: string, args: string[]): this {
        const set = (args ?? []).slice();
        if (set.length > 0) {
            for (let i = 0; i < set.length; i++) {
                set[i] = this.secretMasker.mask(set[i]) ?? "";
            }
        }

        switch (CI_DRIVER) {
            case "azdo":
                stdout.writeSync(
                    new TextEncoder().encode(`##[command]${command} ${set.join(" ")}\n`),
                );
                return this;

            case "github":
                stdout.writeSync(new TextEncoder().encode(`::${command}::${set.join(" ")}\n`));
                return this;

            default:
                if (AnsiSettings.current.mode == AnsiMode.None) {
                    stdout.writeSync(
                        new TextEncoder().encode(`🢖🢖 $ ${command} ${set.join(" ")}\n`),
                    );
                    return this;
                }

                if (AnsiSettings.current.mode == AnsiMode.TwentyFourBit) {
                    this.write(rgb24("$ ", 0xFF6400));
                    let str = "";
                    str += rgb24(`${command}`, 0xff9100);
                    for (let i = 0; i < set.length; i++) {
                        const arg = set[i];
                        str += " ";
                        if (arg.startsWith("-") || arg.startsWith("/")) {
                            str += rgb24(arg, 0x008eff);
                        } else {
                            if (!arg.startsWith("'") && !arg.startsWith('"')) {
                                if (arg.includes("'")) {
                                    str += rgb24(`"${arg}"`, 0xc600ff);
                                } else {
                                    str += rgb24(`'${arg}'`, 0xc600ff);
                                }
                            }
                        }
                    }

                    str += "\n";
                    stdout.writeSync(new TextEncoder().encode(str));
                    return this;
                }

                stdout.writeSync(
                    new TextEncoder().encode(cyan(`🢖🢖 $ ${command} ${set.join(" ")}\n`)),
                );
                return this;
        }
    }

    override startGroup(name: string): this {
        switch (CI_DRIVER) {
            case "azdo":
                stdout.writeSync(new TextEncoder().encode(`##[group]${name}\n`));
                return this;

            case "github":
                stdout.writeSync(new TextEncoder().encode(`::group::${name}\n`));
                return this;

            default:
                if (AnsiSettings.current.mode == AnsiMode.None) {
                    stdout.writeSync(new TextEncoder().encode(`🢖🢖🢖🢖🢖 ${name}\n`));
                    return this;
                }

                if (AnsiSettings.current.mode == AnsiMode.TwentyFourBit) {
                    stdout.writeSync(groupBytes);
                    stdout.writeSync(new TextEncoder().encode(` ${rgb24(name, 0xb400ff)}\n`));
                    return this;
                }

                stdout.writeSync(groupBytes);
                stdout.writeSync(new TextEncoder().encode(magenta(`🢖🢖🢖🢖🢖 ${name}\n`)));
                return this;
        }
    }

    startSkipGroup(name: string): this {
        switch (CI_DRIVER) {
            case "azdo":
                stdout.writeSync(new TextEncoder().encode(`##[group]${name}\n`));
                return this;

            case "github":
                stdout.writeSync(new TextEncoder().encode(`::group::${name}\n`));
                return this;

            default:
                if (AnsiSettings.current.mode == AnsiMode.None) {
                    stdout.writeSync(new TextEncoder().encode(`🢖🢖🢖🢖🢖 ${name}\n`));
                    return this;
                }

                stdout.writeSync(new TextEncoder().encode(gray(`🢖🢖🢖🢖🢖 ${name} (Skipped)\n`)));
                return this;
        }
    }

    override endGroup(): this {
        switch (CI_DRIVER) {
            case "azdo":
                stdout.writeSync(new TextEncoder().encode(`##[endgroup]\n`));
                return this;

            case "github":
                stdout.writeSync(new TextEncoder().encode(`::endgroup::\n`));
                return this;

            default:
                //stdout.writeSync(groupBytes);
                stdout.writeSync(new TextEncoder().encode(`\n`));
                return this;
        }
    }
}

export const rexWriter = new RexWriter();

setLogger((file, args) => {
    rexWriter.command(file, args ?? []);
});
