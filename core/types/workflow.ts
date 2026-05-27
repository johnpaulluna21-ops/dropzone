/**
 * core/types/workflow.ts
 *
 * Workflow primitive contracts.
 * Seed types only — no engine, no registry, no abstraction.
 * Grow this gradually as concrete workflows are implemented.
 */

export type WorkflowStatus =
  | "pending"
  | "processing"
  | "review"
  | "completed"
  | "failed";

export interface WorkflowStep {
  id: string;
  status: WorkflowStatus;
  createdAt: string;
  updatedAt?: string;
}