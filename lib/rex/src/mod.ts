export * from "./scripting.ts"
export {
    Inputs,
    Outputs,
    StringMap,
    type LoggingMessageBus,
    LogLevel,
    type RexWriter, 
} from "@rex/primitives"

export {
    type Task,
    type TaskContext,
    TaskBuilder,
    TaskMap,
    type RunDelegate,
    REX_TASKS,
    REX_TASKS_REGISTRY,
    task, 
    usesTask,
    output,
    toError,
    type TaskDescriptor,
} from "@rex/tasks"
export {
    job,
    type Job,
    type JobContext,
    REX_JOBS,
    JobBuilder,
    JobMap,
} from "@rex/jobs"
export {
    deploy,
    type Deployment,
    type DeploymentContext,
    REX_DEPLOYMENTS,
    REX_DEPLOYMENT_REGISTRY,
    DeploymentBuilder,
    type Deploy,
    DeploymentMap,
    type DeploymentDescriptor,
} from "@rex/deployments"

export * from "@rex/tasks-scripts"