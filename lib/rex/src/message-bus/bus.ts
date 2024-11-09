export interface MessageSink {
    (message: Message): void;
}

export interface Message extends Record<string, unknown> {
    kind: string;
}

export interface MessageBus {
    addListener(listener: MessageSink): void;
    removeListener(listener: MessageSink): void;
    send(message: Message): void;
}

export class DefaultMessageBus {
    private listeners: MessageSink[] = [];

    addListener(listener: MessageSink): void {
        this.listeners.push(listener);
    }

    removeListener(listener: MessageSink): void {
        const index = this.listeners.indexOf(listener);
        if (index >= 0) {
            this.listeners.splice(index, 1);
        }
    }

    send(message: Message): void {
        this.listeners.forEach((listener) => listener(message));
    }
}

export function logLevelToString(level: LogLevel): string {
    switch (level) {
        case LogLevel.Trace:
            return "trace";
        case LogLevel.Debug:
            return "debug";
        case LogLevel.Info:
            return "info";
        case LogLevel.Warn:
            return "warn";
        case LogLevel.Error:
            return "error";
        case LogLevel.Fatal:
            return "fatal";
        default:
            return "unknown";
    }
}

export class LogMessage implements Message {
    error?: Error;
    message?: string;
    args?: unknown[];
    level: LogLevel;
    timestamp: Date = new Date();
    kind: string;

    [key: string]: unknown;

    constructor(level: LogLevel, error?: Error, message?: string, args?: unknown[]) {
        this.kind = "log";
        this.level = level;
        this.error = error;
        this.message = message;
        this.args = args;
    }
}

export enum LogLevel {
    Trace = 7,
    Debug = 6,
    Info = 6,
    Warn = 4,
    Error = 3,
    Fatal = 2,
}

export interface LoggingMessageBus extends MessageBus {
    isEnabled(level: LogLevel): boolean;

    setLevel(level: LogLevel): void;

    fatal(error: Error, message?: string, ...args: unknown[]): void;
    fatal(message: string, ...args: unknown[]): void;
    error(error: Error, message?: string, ...args: unknown[]): void;
    error(message?: string, ...args: unknown[]): void;
    warn(error: Error, message?: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    info(error: Error, message?: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    debug(error: Error, message?: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
    trace(error: Error, message?: string, ...args: unknown[]): void;
    trace(message: string, ...args: unknown[]): void;
}

export class DefaultLoggingMessageBus extends DefaultMessageBus implements LoggingMessageBus {
    #level: LogLevel = LogLevel.Info;

    isEnabled(level: LogLevel): boolean {
        return this.#level >= level;
    }

    setLevel(level: LogLevel): void {
        this.#level = level;
    }

    fatal(error: Error, message?: string, ...args: unknown[]): void;
    fatal(message: string, ...args: unknown[]): void;
    fatal(): void {
        const first = arguments[0];
        let args: undefined | unknown[] = undefined;
        let message: undefined | string = undefined;
        let error: undefined | Error = undefined;
        if (first instanceof Error) {
            error = first;
            message = arguments[1];
            args = Array.prototype.slice.call(arguments, 2);
        } else {
            message = first;
            args = Array.prototype.slice.call(arguments, 1);
        }

        this.send(new LogMessage(LogLevel.Fatal, error, message, args));
    }

    error(error: Error, message?: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    error(): void {
        const first = arguments[0];
        let args: undefined | unknown[] = undefined;
        let message: undefined | string = undefined;
        let error: undefined | Error = undefined;
        if (first instanceof Error) {
            error = first;
            message = arguments[1];
            args = Array.prototype.slice.call(arguments, 2);
        } else {
            message = first;
            args = Array.prototype.slice.call(arguments, 1);
        }

        this.send(new LogMessage(LogLevel.Error, error, message, args));
    }

    warn(error: Error, message?: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    warn(): void {
        const first = arguments[0];
        let args: undefined | unknown[] = undefined;
        let message: undefined | string = undefined;
        let error: undefined | Error = undefined;
        if (first instanceof Error) {
            error = first;
            message = arguments[1];
            args = Array.prototype.slice.call(arguments, 2);
        } else {
            message = first;
            args = Array.prototype.slice.call(arguments, 1);
        }

        this.send(new LogMessage(LogLevel.Warn, error, message, args));
    }

    info(error: Error, message?: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    info(): void {
        const first = arguments[0];
        let args: undefined | unknown[] = undefined;
        let message: undefined | string = undefined;
        let error: undefined | Error = undefined;
        if (first instanceof Error) {
            error = first;
            message = arguments[1];
            args = Array.prototype.slice.call(arguments, 2);
        } else {
            message = first;
            args = Array.prototype.slice.call(arguments, 1);
        }

        this.send(new LogMessage(LogLevel.Info, error, message, args));
    }

    debug(error: Error, message?: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
    debug(): void {
        const first = arguments[0];
        let args: undefined | unknown[] = undefined;
        let message: undefined | string = undefined;
        let error: undefined | Error = undefined;
        if (first instanceof Error) {
            error = first;
            message = arguments[1];
            args = Array.prototype.slice.call(arguments, 2);
        } else {
            message = first;
            args = Array.prototype.slice.call(arguments, 1);
        }

        this.send(new LogMessage(LogLevel.Debug, error, message, args));
    }

    trace(error: Error, message?: string, ...args: unknown[]): void;
    trace(message: string, ...args: unknown[]): void;
    trace(): void {
        const first = arguments[0];
        let args: undefined | unknown[] = undefined;
        let message: undefined | string = undefined;
        let error: undefined | Error = undefined;
        if (first instanceof Error) {
            error = first;
            message = arguments[1];
            args = Array.prototype.slice.call(arguments, 2);
        } else {
            message = first;
            args = Array.prototype.slice.call(arguments, 1);
        }

        this.send(new LogMessage(LogLevel.Trace, error, message, args));
    }
}
