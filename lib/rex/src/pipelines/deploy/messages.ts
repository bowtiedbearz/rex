
import { BaseMessage } from "../../message-bus/mod.ts";
import type { TaskResult } from "../tasks/primitives.ts";
import type { DeployServiceState, } from "./primitives.ts";

export class DeployStarted extends BaseMessage {
    constructor(public readonly state: DeployServiceState) {
        super("deploy:started");
    }
}

export class DeployCompleted extends BaseMessage {
    constructor(public readonly state: DeployServiceState, public readonly result: TaskResult) {
        super("task:completed");
    }
}

export class DeploySkipped extends BaseMessage {
    constructor(public readonly state: DeployServiceState) {
        super("task:skipped");
    }
}

export class DeployFailed extends BaseMessage {
    constructor(public readonly state: DeployServiceState, public readonly error: Error) {
        super("task:failed");
    }
}

export class DeployCancelled extends BaseMessage {
    constructor(public readonly state: DeployServiceState) {
        super("task:cancelled");
    }
}
