import type { Status } from "@/lib/triage/schema";
import type { TriageResult } from "@/lib/triage/types";
import type { ReportRow, WorkOrderRow } from "./types";

export interface SavedTriage {
  report: ReportRow;
  workOrders: WorkOrderRow[];
}

export interface TriageStore {
  saveTriage(result: TriageResult): Promise<SavedTriage | null>;
  allowIntake(ipHash: string, maxPerMinute: number): Promise<boolean>;
  updateStatus(id: string, status: Status): Promise<WorkOrderRow | null>;
}

export class StoreError extends Error {
  constructor(
    operation: string,
    cause: { message: string; code?: string; details?: string; hint?: string },
  ) {
    super(`Database ${operation} failed: ${cause.message}`, { cause });
    this.name = "StoreError";
  }
}
