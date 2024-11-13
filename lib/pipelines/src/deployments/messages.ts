import { BaseMessage } from "../bus.ts";
import type { DeploymentState, Deployment, DeploymentResult, DeploymentMap } from "@rex/deployments";

export class DeploymentStarted extends BaseMessage {
    constructor(public readonly state: DeploymentState) {
        super("deployment:started");
    }
}

export class DeploymentCompleted extends BaseMessage {
    constructor(public readonly state: DeploymentState, public readonly result: DeploymentResult) {
        super("deployment:completed");
    }
}

export class DeploymentSkipped extends BaseMessage {
    constructor(public readonly state: DeploymentState) {
        super("deployment:skipped");
    }
}

export class DeploymentFailed extends BaseMessage {
    constructor(public readonly state: DeploymentState, public readonly error: Error) {
        super("deployment:failed");
    }
}

export class DeploymentCancelled extends BaseMessage {
    constructor(public readonly state: DeploymentState) {
        super("deployment:cancelled");
    }
}

export class MissingDeploymentDependencies extends BaseMessage {
    constructor(public readonly deployments: Array<{ deployment: Deployment; missing: string[] }>) {
        super("deployment:missing-dependencies");
    }
}

export class CyclicalDeploymentReferences extends BaseMessage {
    constructor(public readonly deployments: Deployment[]) {
        super("deployment:cyclical-references");
    }
}

export class DeploymentNotFound extends BaseMessage {
    constructor(public readonly deploymentName: string) {
        super("deployment:not-found");
    }
}

export class ListDeployments extends BaseMessage {
    constructor(public readonly deployments: DeploymentMap) {
        super("deployment:list");
    }
}
