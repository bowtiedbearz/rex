import { BaseMessage } from "../../message-bus/messages.ts";
import type { Job, JobState } from "./primitives.ts";

export class JobStarted extends BaseMessage {
    constructor(public readonly job: JobState) {
        super("job:started");
    }
}

export class JobCompleted extends BaseMessage {
    constructor(public readonly job: JobState) {
        super("job:completed");
    }
}

export class JobSkipped extends BaseMessage {
    constructor(public readonly job: JobState) {
        super("job:skipped");
    }
}

export class JobFailed extends BaseMessage {
    constructor(public readonly job: JobState, public readonly error: Error) {
        super("job:failed");
    }
}

export class JobCancelled extends BaseMessage {
    constructor(public readonly job: JobState) {
        super("job:cancelled");
    }
}

export class MissingDependencies extends BaseMessage {
    constructor(public readonly jobs: Array<{ job: Job; missing: string[] }>) {
        super("jobs:missing-dependencies");
    }
}

export class CyclicalJobReferences extends BaseMessage {
    constructor(public readonly jobs: Job[]) {
        super("jobs:cyclical-references");
    }
}

export class JobNotFound extends BaseMessage {
    constructor(public readonly jobName: string) {
        super("job:not-found");
    }
}
